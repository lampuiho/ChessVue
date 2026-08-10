import { describe, expect, it } from 'vitest';

import { EngineAnalysisSearchMode, EngineAvailability, EngineClientType, PlatformErrorKind } from '@/contracts';
import { EngineRuntimeService, PositionIdentityService } from '@/domain';
import type { IEngineAnalysisUpdate } from '@/contracts/platform';
import { createAssignedEngine, createEnginePositionState, getBoardId, registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('NwjsUciEngineClient', () => {
  it('maps engine state to UCI commands and parses analysis plus player moves through one process', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const positionState = createEnginePositionState();
    const updates: IEngineAnalysisUpdate[] = [];
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    const syncPromise = client.syncPosition(engine, positionState);
    const process = getEnvironment().latestProcess();
    process.queueResponse('go infinite', [
      'info depth 14 multipv 1 score cp 34 pv e7e5 g1f3',
      'info depth 14 multipv 2 score cp 18 pv c7c5',
      'bestmove e7e5',
    ]);
    process.queueResponse('go', ['bestmove e7e5']);
    await syncPromise;
    await client.startAnalysis(engine, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => {
      updates.push(update);
    });
    await client.startPlayerTurn(engine);
    const bestMove = await client.awaitPlayerTurnMove(engine);
    const commandLog = process.getCommandLog();

    expect(commandLog).toContain('uci');
    expect(commandLog).toContain('setoption name Threads value 1');
    expect(commandLog).toContain('ucinewgame');
    expect(commandLog).toContain('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 moves e2e4');
    expect(updates).toHaveLength(3);
    expect(updates[2]!.positionKey).toBe(PositionIdentityService.buildPositionKey(positionState.currentPosition));
    expect(bestMove.from).toBe(getBoardId(4, 6));
    expect(bestMove.to).toBe(getBoardId(4, 4));
  });
  it('reinitialises through EngineRuntimeService when a stored process handle becomes stale', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const positionState = createEnginePositionState();
    const staleHandle = await manager.spawnProcess(engine.executablePath);
    engine.$ = { processHandle: staleHandle, availability: EngineAvailability.Ready, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    await manager.stopProcess(staleHandle);
    await EngineRuntimeService.syncPosition(engine, positionState);

    expect(engine.$?.processHandle).toBeDefined();
    expect(engine.$?.processHandle).not.toBe(staleHandle);
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
    expect(getEnvironment().latestProcess().getCommandLog()).toContain('uci');
  });
  it('throws when a session-dependent action runs before initialiseEngine creates a session', async () => {
    const platform = getPlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };
    const positionState = createEnginePositionState();

    await expect(client.syncPosition(engine, positionState)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startAnalysis(engine, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPlayerTurn(engine)).rejects.toMatchObject({
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
