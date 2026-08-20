import { describe, expect, it } from 'vitest';

import { EngineAnalysisSearchMode, EngineAvailability, EngineClientType, EngineOptionType, MoveKind, PieceKind, PlatformErrorKind, PlayerColour, type IGame, type IMove } from '@/contracts';
import type { IEngineAnalysisUpdate } from '@/contracts/platform';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService, PositionIdentityService } from '@/domain';
import { GameRuleUtility } from '@/utility/chess';
import { createAssignedEngine, createEngineGame, getBoardId, registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

function appendLiveMove(game: IGame, move: IMove): void {
  let node = game.moveTree.root;
  for (const childIndex of game.livePath ?? []) node = node.children[childIndex]!;
  MoveHistoryService.addMainlineMove(node, move, MoveApplicationService.applyMove(node.position, move), game.clockSnapshot);
  game.livePath!.push(0);
  game.highlightPath = [...game.livePath!];
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
    await client.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => updates.push(update));
    process.queueResponse('stop', ['bestmove e7e5']);
    await client.stopAnalysis(engine);

    const timedGo = 'go wtime 60000 btime 60000 winc 1000 binc 1000';
    process.queueResponse(timedGo, ['bestmove e7e5 ponder g1f3']);
    await client.startPlayerTurn(engine, game);
    const firstMove = await client.awaitPlayerTurnMove(engine);
    appendLiveMove(game, firstMove);
    await client.startPondering(engine, game, firstMove.$!.ponderMove!);
    appendLiveMove(game, firstMove.$!.ponderMove!);
    process.queueResponse('ponderhit', ['bestmove b8c6 ponder f1c4']);
    await client.startPlayerTurn(engine, game);
    const ponderHitMove = await client.awaitPlayerTurnMove(engine);

    appendLiveMove(game, ponderHitMove);
    await client.startPondering(engine, game, ponderHitMove.$!.ponderMove!);
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
    expect(commandLog).toContain('go ponder wtime 60000 btime 60000 winc 1000 binc 1000');
    expect(commandLog).toContain('ponderhit');
    expect(commandLog.filter((command) => command === 'stop')).toHaveLength(2);
    expect(commandLog[ponderMissStopIndex + 1]).toMatch(/^position startpos /);
    expect(commandLog[ponderMissStopIndex + 2]).toBe(timedGo);
    expect(updates).toHaveLength(2);
    expect(updates[1]!.positionKey).toBe(PositionIdentityService.buildPositionKey(game.moveTree.root.children[0]!.position));
    expect(firstMove.$?.ponderMove?.$?.uci).toBe('g1f3');
    expect(ponderHitMove.$?.uci).toBe('b8c6');
    expect(ponderMissMove.$?.uci).toBe('g8f6');
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
    const ponderMove: IMove = { from: getBoardId(4, 6), to: getBoardId(4, 4), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn };

    await expect(client.startAnalysis(engine, game, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPlayerTurn(engine, game)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPondering(engine, game, ponderMove)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.awaitPlayerTurnMove(engine)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
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
