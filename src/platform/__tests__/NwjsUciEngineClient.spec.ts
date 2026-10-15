import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EngineAnalysisSearchMode, EngineAvailability, EngineClientType, EngineOptionType, MoveKind, PieceKind, PlatformErrorKind, PlayerColour, type IGame, type IMove } from '@/contracts';
import type { IEngineAnalysisUpdate } from '@/contracts/platform';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import { flushPromises } from '@vue/test-utils';
import { createAssignedEngine, createEngineGame, getBoardId, registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();
let EngineRuntimeService: typeof import('@/domain').EngineRuntimeService;
beforeEach(async () => {
  ({ EngineRuntimeService } = await import('@/domain'));
});

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
  it.each(['stopEngine', 'restartEngine'] as const)('does not deliver another analysis call\'s move after superseded %s', async (terminalAction) => {
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const request = { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite };
    const updates: IEngineAnalysisUpdate[] = [];
    EngineRuntimeService.subscribeToAnalysis(engine, (update) => updates.push(update));
    await EngineRuntimeService.startAnalysis(engine, game, request);
    const process = getEnvironment().latestProcess();
    const handle = engine.$!.processHandle;
    const nextGame = createEngineGame();
    appendLiveMove(nextGame, { from: getBoardId(4, 6), to: getBoardId(4, 4), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn });
    // B waits for A's Stop response; disposal D is then superseded by C returning to A's position.
    const replacing = EngineRuntimeService.startAnalysis(engine, nextGame, request).catch((error) => error);
    await flushPromises();
    expect(process.getCommandLog().slice(-1)).toEqual(['stop']);
    const disposal = EngineRuntimeService[terminalAction](engine).catch((error) => error);
    const latest = EngineRuntimeService.startAnalysis(engine, game, request);
    await flushPromises();
    // This old move is also legal in C's position, so legality validation cannot hide misrouting.
    process.stdout.write('info depth 10 score cp 20 pv e7e5\nbestmove e7e5\n');
    await flushPromises();
    expect(updates).toHaveLength(0);
    expect(process.getCommandLog().filter((command) => command === 'stop')).toHaveLength(2);
    expect(process.getCommandLog().slice(-3)).toEqual(['position startpos moves e2e4 e7e5', 'go infinite', 'stop']);
    expect(engine.$!.availability).toBe(EngineAvailability.Starting);
    // C must also drain B's own final reply before sending its position/go commands.
    process.stdout.write('info depth 11 score cp 25 pv g1f3\nbestmove g1f3\n');
    await latest;
    expect(updates).toHaveLength(0);
    expect(engine.$!.analysisLines.size).toBe(0);
    expect(process.getCommandLog().filter((command) => command === 'uci')).toHaveLength(1);
    expect(process.getCommandLog().slice(-2)).toEqual(['position startpos moves e2e4', 'go infinite']);
    expect(await replacing).toBeInstanceOf(Error);
    expect(await disposal).toBeInstanceOf(Error);
    expect(engine.$!.processHandle).toBe(handle);
    expect(getEnvironment().latestProcess()).toBe(process);
    expect(engine.$!.availability).toBe(EngineAvailability.Running);
    process.stdout.write('info depth 12 score cp 30 pv c7c5\nbestmove c7c5\n');
    expect(updates.map((update) => ({ isFinal: update.isFinal, bestMove: update.bestMove?.$?.uci, pv: update.lines[0]!.pv.map((move) => move.$?.uci) }))).toEqual([
      { isFinal: false, bestMove: 'c7c5', pv: ['c7c5'] },
      { isFinal: true, bestMove: 'c7c5', pv: ['c7c5'] },
    ]);
    expect(engine.$!.availability).toBe(EngineAvailability.Ready);
    await EngineRuntimeService.stopEngine(engine);
  });
  it('keeps the original Stop response context when Stop Analysis supersedes engine disposal', async () => {
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const request = { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite };
    EngineRuntimeService.subscribeToAnalysis(engine, () => undefined);
    await EngineRuntimeService.startAnalysis(engine, game, request);
    const process = getEnvironment().latestProcess();
    const handle = engine.$!.processHandle;
    const replacing = EngineRuntimeService.startAnalysis(engine, game, request).catch((error) => error);
    await flushPromises();
    const disposal = EngineRuntimeService.stopEngine(engine).catch((error) => error);
    const stopping = EngineRuntimeService.stopAnalysis(engine);
    process.stdout.write('bestmove e7e5\n');
    await flushPromises();
    expect(process.getCommandLog().filter((command) => command === 'stop')).toHaveLength(2);
    process.stdout.write('bestmove e7e5\n');
    await stopping;
    expect(await replacing).toBeInstanceOf(Error);
    expect(await disposal).toBeInstanceOf(Error);
    expect(engine.$!.processHandle).toBe(handle);
    expect(engine.$!.availability).toBe(EngineAvailability.Ready);
    await EngineRuntimeService.stopEngine(engine);
  });
  it('retains every reported MultiPV rank in ordered runtime updates', async () => {
    const platform = getPlatformService();
    const engine = createAssignedEngine();
    const updates: IEngineAnalysisUpdate[] = [];
    await EngineRuntimeService.ensureReady(engine);
    EngineRuntimeService.subscribeToAnalysis(engine, (update) => updates.push(update));
    const process = getEnvironment().latestProcess();
    process.queueResponse('go infinite', [5, 2, 4, 1, 3].map((rank) => `info depth 12 multipv ${rank} score cp ${40 - rank} pv e7e5`));
    await EngineRuntimeService.startAnalysis(engine, createEngineGame(), { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
    expect(engine.$!.analysisLines.size).toBe(5);
    expect(updates[updates.length - 1]!.lines.map((line) => line.$!.reference)).toEqual([1, 2, 3, 4, 5]);
    const retained = updates[updates.length - 1]!.lines;
    process.queueResponse('stop', ['bestmove e7e5']);
    await platform.getEngineClient(engine.clientType).stopAnalysis(engine);
    process.queueResponse('go infinite', []);
    await EngineRuntimeService.startAnalysis(engine, createEngineGame(), { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
    expect(engine.$!.analysisLines.size).toBe(0);
    expect(retained).toHaveLength(5);
  });
  it('captures matching commands and parsing position before a delayed game-boundary response', async () => {
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const updates: IEngineAnalysisUpdate[] = [];
    await EngineRuntimeService.ensureReady(engine);
    const client = getPlatformService().getEngineClient(engine.clientType);
    const process = getEnvironment().latestProcess();
    process.queueResponse('isready', []);
    process.queueResponse('go infinite', ['info depth 10 score cp 20 pv e7e5 g1f3']);
    const starting = client.startAnalysis(engine, game, { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => { updates.push(update); });
    await flushPromises();
    expect(process.getCommandLog().slice(-1)).toEqual(['isready']);
    appendLiveMove(game, { from: getBoardId(4, 6), to: getBoardId(4, 4), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn });
    MoveApplicationService.deletePiece(game.rootPosition, getBoardId(0, 0));
    process.stdout.write('readyok\n');
    await starting;
    expect(process.getCommandLog().slice(-2)).toEqual(['position startpos moves e2e4', 'go infinite']);
    expect(updates[0]!.position.sideToMove).toBe(PlayerColour.Black);
    expect(updates[0]!.position.board[getBoardId(4, 6)]?.kind).toBe(PieceKind.Pawn);
    expect(updates[0]!.lines[0]!.pv).toHaveLength(2);
    expect(game.$!.renderedPosition!.sideToMove).toBe(PlayerColour.White);
  });
  it.each(['stopEngine', 'restartEngine'] as const)('%s releases an analysis startup waiting for readyok without reviving the old client', async (terminalAction) => {
    const engine = createAssignedEngine();
    await EngineRuntimeService.ensureReady(engine);
    const process = getEnvironment().latestProcess();
    const handle = engine.$!.processHandle;
    process.queueResponse('isready', []);
    const starting = EngineRuntimeService.startAnalysis(engine, createEngineGame(), { multiPv: 1, searchMode: EngineAnalysisSearchMode.Infinite }).catch((error) => error);
    await flushPromises();
    expect(process.getCommandLog().slice(-1)).toEqual(['isready']);
    await EngineRuntimeService[terminalAction](engine);
    expect(await starting).toBeInstanceOf(Error);
    process.stdout.write('readyok\n');
    await flushPromises();
    expect(process.getCommandLog()).not.toContain('go infinite');
    if (terminalAction === 'stopEngine') {
      expect(engine.$!.processHandle).toBeUndefined();
      expect(engine.$!.availability).toBe(EngineAvailability.Unavailable);
    } else {
      expect(engine.$!.processHandle).toBeDefined();
      expect(engine.$!.processHandle).not.toBe(handle);
      expect(engine.$!.availability).toBe(EngineAvailability.Ready);
      await EngineRuntimeService.stopEngine(engine);
    }
  });
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
    const analysedPosition = MoveApplicationService.genPosition(game.$!.renderedPosition!, []);
    await client.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => { updates.push(update); });
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
    expect(updates[1]!.position).toEqual(analysedPosition);
    expect(updates[1]!.position).not.toBe(game.$!.renderedPosition);
    expect(firstMove.$?.ponderMove?.$?.uci).toBe('g1f3');
    expect(ponderHitMove.$?.uci).toBe('b8c6');
    expect(ponderMissMove.$?.uci).toBe('g8f6');
  });
  it('discards malformed and runtime-rejected analysis messages without replacing valid output or failing the session', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const game = createEngineGame();
    const updates: IEngineAnalysisUpdate[] = [];
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };
    await client.initialiseEngine(engine);
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, (update) => updates.push(update));
    const process = getEnvironment().latestProcess();
    process.queueResponse('go infinite', [
      'info depth 14 multipv 1 score cp 34 pv e7e5 g1f3',
      'info depth 15 multipv 1 score cp 40 pv e7e9',
      'info depth 16 multipv 1 score cp 45 pv e7e5 g1g3',
      'info depth 17 multipv 2 score cp 38 pv c7c5 g1f3',
    ]);

    await EngineRuntimeService.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite });
    await vi.waitFor(() => expect(updates).toHaveLength(2));
    process.queueResponse('stop', ['bestmove e7e5']);
    await EngineRuntimeService.stopAnalysis(engine);
    unsubscribe();

    expect(updates.map((update) => update.lines.map((line) => line.depth))).toEqual([[14], [14, 17]]);
    expect(updates[1]!.lines[0]!.pv.map((move) => move.$?.uci)).toEqual(['e7e5', 'g1f3']);
    expect(updates[1]!.lines[1]!.pv.map((move) => move.$?.uci)).toEqual(['c7c5', 'g1f3']);
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
    expect(engine.$?.lastError).toBeUndefined();
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
