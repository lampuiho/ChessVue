import { describe, expect, it } from 'vitest';

import { EngineAnalysisSearchMode, EngineAvailability, EngineClientType, EngineOptionType, MoveKind, PieceKind, PlatformErrorKind, PlayerColour, type IGame, type IMove } from '@/contracts';
import type { IEngineAnalysisUpdate } from '@/contracts/platform';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService, PositionIdentityService } from '@/domain';
import { createAssignedEngine, createEngineGame, getBoardId, registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

function appendLiveMove(game: IGame, move: IMove): void {
  let node = game.moveTree.root;
  for (const childIndex of game.livePath ?? []) node = node.children[childIndex]!;
  const nextNode = MoveHistoryService.addMainlineMove(node, move, game.clockSnapshot);
  const nextPath = [...game.livePath!, node.children.indexOf(nextNode)];
  game.livePath = nextPath;
  game.renderedPath = nextPath;
  // the store owns these slots in production; applying in place is what keeps them current
  const runtime = game.$!;
  const nextPosition = MoveApplicationService.applyMove(runtime.livePosition!, move);
  runtime.livePosition = nextPosition;
  runtime.renderedPosition = nextPosition;
  runtime.liveNode = nextNode;
  runtime.renderedNode = nextNode;
}

describe('NwjsUciEngineClient', () => {
  it('collects engine option metadata during initialisation', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
    const process = getEnvironment().latestProcess();
    process.queueResponse('uci', [
      'option name Ponder type check default false',
      'option name Threads type spin default 1 min 1 max 1024',
      'uciok',
    ]);

    await client.initialiseEngine(engine);

    expect(client.getOptions(engine)).toEqual([
      { name: 'Ponder', type: EngineOptionType.Boolean, defaultValue: false },
      { name: 'Threads', type: EngineOptionType.Integer, defaultValue: 1, minimum: 1, maximum: 1024 },
    ]);
  });
  it('routes analysis, player, ponder-hit, and ponder-miss output through session states', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const updates: IEngineAnalysisUpdate[] = [];
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    const process = getEnvironment().latestProcess();
    process.queueResponse('go infinite', [
      'info depth 14 multipv 1 score cp 34 pv e7e5 g1f3',
      'info depth 14 multipv 2 score cp 18 pv c7c5',
    ]);
    // captured before appendLiveMove advances the same object in place
    const analysedPositionKey = PositionIdentityService.buildPositionKey(game.$!.renderedPosition!);
    await client.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => updates.push(update));
    process.queueResponse('stop', ['bestmove e7e5']);
    await client.stopAnalysis(engine);

    const timedGo = 'go wtime 60000 btime 60000 winc 1000 binc 1000';
    process.queueResponse(timedGo, ['bestmove e7e5 ponder g1f3']);
    await client.startPlayerTurn(engine, game);
    const firstMove = await client.awaitPlayerTurnMove(engine);
    const firstPonderPath = [...game.livePath!];
    await client.startPondering(engine, game, firstMove, firstMove.$!.ponderMove!);
    expect(game.livePath).toEqual(firstPonderPath);
    appendLiveMove(game, firstMove);
    appendLiveMove(game, firstMove.$!.ponderMove!);
    process.queueResponse('ponderhit', ['bestmove b8c6 ponder f1c4']);
    await client.startPlayerTurn(engine, game);
    const ponderHitMove = await client.awaitPlayerTurnMove(engine);

    const secondPonderPath = [...game.livePath!];
    await client.startPondering(engine, game, ponderHitMove, ponderHitMove.$!.ponderMove!);
    expect(game.livePath).toEqual(secondPonderPath);
    appendLiveMove(game, ponderHitMove);
    const unexpectedMove: IMove = { from: getBoardId(3, 1), to: getBoardId(3, 3), kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn };
    appendLiveMove(game, unexpectedMove);
    process.queueResponse('stop', ['bestmove a7a6']);
    process.queueResponse(timedGo, ['bestmove g8f6']);
    await client.startPlayerTurn(engine, game);
    const ponderMissMove = await client.awaitPlayerTurnMove(engine);
    const commandLog = process.getCommandLog();
    const ponderMissStopIndex = commandLog.lastIndexOf('stop');

    expect(commandLog).toContain('uci');
    expect(commandLog).toContain('setoption name Threads value 1');
    expect(commandLog).toContain('ucinewgame');
    expect(commandLog).toContain('position startpos moves e2e4 e7e5 g1f3');
    expect(commandLog).toContain('position startpos moves e2e4 e7e5 g1f3 b8c6 f1c4');
    expect(commandLog).toContain('go ponder wtime 60000 btime 60000 winc 1000 binc 1000');
    expect(commandLog).toContain('ponderhit');
    expect(commandLog.filter((command) => command === 'stop')).toHaveLength(2);
    expect(commandLog[ponderMissStopIndex + 1]).toMatch(/^position startpos /);
    expect(commandLog[ponderMissStopIndex + 2]).toBe(timedGo);
    expect(updates).toHaveLength(2);
    expect(updates[1]!.positionKey).toBe(analysedPositionKey);
    expect(firstMove.$?.ponderMove?.$?.uci).toBe('g1f3');
    expect(ponderHitMove.$?.uci).toBe('b8c6');
    expect(ponderMissMove.$?.uci).toBe('g8f6');
  });
  it('rebuilds a missed ponder search from the current game after stop completes', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const game = createEngineGame();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
    await client.initialiseEngine(engine);
    const process = getEnvironment().latestProcess();
    const timedGo = 'go wtime 60000 btime 60000 winc 1000 binc 1000';
    process.queueResponse(timedGo, ['bestmove e7e5 ponder g1f3']);
    await client.startPlayerTurn(engine, game);
    const engineMove = await client.awaitPlayerTurnMove(engine);
    await client.startPondering(engine, game, engineMove, engineMove.$!.ponderMove!);
    appendLiveMove(game, engineMove);
    appendLiveMove(game, { from: getBoardId(3, 1), to: getBoardId(3, 3), kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn });
    process.queueResponse('stop', []);

    const startPromise = client.startPlayerTurn(engine, game);
    const commandLogWhileStopping = process.getCommandLog();
    expect(commandLogWhileStopping[commandLogWhileStopping.length - 1]).toBe('stop');
    appendLiveMove(game, { from: getBoardId(0, 6), to: getBoardId(0, 5), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn });
    MoveApplicationService.deletePiece(game.rootPosition, getBoardId(0, 0));
    process.queueResponse(timedGo, ['bestmove g1f3']);
    process.stdout.write('bestmove h7h6\n');
    await startPromise;
    const move = await client.awaitPlayerTurnMove(engine);
    const commandLog = process.getCommandLog();
    const stopIndex = commandLog.lastIndexOf('stop');

    expect(commandLog.slice(stopIndex + 1, stopIndex + 5)).toEqual([
      'ucinewgame',
      'isready',
      expect.stringMatching(/^position fen .* moves e2e4 e7e5 d2d4 a7a6$/),
      timedGo,
    ]);
    expect(move.$?.uci).toBe('g1f3');
  });
  it('reinitialises through EngineRuntimeService when a stored process handle becomes stale', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const staleHandle = await manager.spawnProcess(engine.executablePath);
    engine.$ = { processHandle: staleHandle, availability: EngineAvailability.Ready, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    await manager.stopProcess(staleHandle);
    await EngineRuntimeService.startAnalysis(engine, game, { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite });

    expect(engine.$?.processHandle).toBeDefined();
    expect(engine.$?.processHandle).not.toBe(staleHandle);
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
    expect(getEnvironment().latestProcess().getCommandLog()).toContain('uci');
  });
  it('rebuilds an initialised session when its process handle is replaced', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };
    await client.initialiseEngine(engine);

    engine.$.processHandle = await manager.spawnProcess(engine.executablePath);
    await client.initialiseEngine(engine);

    expect(getEnvironment().latestProcess().getCommandLog()).toContain('uci');
  });
  it('throws when a session-dependent action runs before initialiseEngine creates a session', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };
    const game = createEngineGame();
    const engineMove: IMove = { from: getBoardId(4, 6), to: getBoardId(4, 4), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn };
    const ponderMove: IMove = { from: getBoardId(6, 0), to: getBoardId(5, 2), kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Knight };

    await expect(client.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPlayerTurn(engine, game)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPondering(engine, game, engineMove, ponderMove)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.awaitPlayerTurnMove(engine)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
  });
  it('throws when the game runtime has no position for the requested search', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
    const game = createEngineGame();
    await client.initialiseEngine(engine);
    game.$!.renderedPosition = undefined;
    game.$!.livePosition = undefined;

    await expect(client.startAnalysis(engine, game, { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined))
      .rejects.toThrow(/Rendered position is unavailable/);
    await expect(client.startPlayerTurn(engine, game)).rejects.toThrow(/Live position is unavailable/);
  });
  it('re-emits ucinewgame when the board root is edited in place', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
    const game = createEngineGame();

    await client.initialiseEngine(engine);
    const process = getEnvironment().latestProcess();
    await client.startAnalysis(engine, game, { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined);
    process.queueResponse('stop', ['bestmove e7e5']);
    await client.stopAnalysis(engine);
    const newGameCountBeforeEdit = process.getCommandLog().filter((command) => command === 'ucinewgame').length;

    // a board edit keeps the same rootPosition object, so only its value can reveal the change
    MoveApplicationService.deletePiece(game.rootPosition, getBoardId(0, 0));
    await client.startAnalysis(engine, game, { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined);

    expect(process.getCommandLog().filter((command) => command === 'ucinewgame')).toHaveLength(newGameCountBeforeEdit + 1);
  });
  it('defers registration when the engine reports a registration error', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };
    const process = getEnvironment().latestProcess();
    process.queueResponse('uci', ['registration error', 'uciok']);

    await client.initialiseEngine(engine);

    expect(process.getCommandLog()).toContain('register later');
  });
});
