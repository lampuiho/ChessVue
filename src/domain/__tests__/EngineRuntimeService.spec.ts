import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  MoveKind,
  PlatformErrorKind,
  PlayerColour,
  type IAssignedEngine,
  type IEngineAnalysisRequest,
  type IEngineRegistrationRequest,
  type IMove,
} from '@/contracts';

let EngineRuntimeService: typeof import('..').EngineRuntimeService;
const spawnProcess = vi.fn();
const assertProcessHandleOpen = vi.fn();
const stopProcess = vi.fn();
const restartProcess = vi.fn();
const initialiseEngine = vi.fn();
const registerEngine = vi.fn();
const syncPosition = vi.fn();
const startAnalysis = vi.fn();
const stopAnalysis = vi.fn();
const startPlayerTurn = vi.fn();
const awaitPlayerTurnMove = vi.fn();
const stopEngine = vi.fn();

const boardId = (file: number, rank: number) => file + (rank * 8);

function createAssignedEngine(): IAssignedEngine {
  return {
    displayName: 'Stockfish',
    executablePath: 'stockfish.exe',
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 1 },
    $: {
      availability: EngineAvailability.Unavailable,
      analysisLines: new Map(),
    },
  };
}
function createAnalysisRequest(): IEngineAnalysisRequest {
  return { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite };
}
function createRegistrationRequest(): IEngineRegistrationRequest {
  return { name: 'Tester', code: 'abcd', registerLater: false };
}
function createMove(): IMove {
  return {
    from: boardId(4, 1),
    to: boardId(4, 3),
    kind: MoveKind.Normal,
    movingColour: PlayerColour.White,
  };
}
function createInvalidHandleError(message: string) {
  return {
    kind: PlatformErrorKind.InvalidProcessHandle,
    operation: 'assertProcessHandleOpen',
    message,
  };
}

describe('EngineRuntimeService', () => {
  beforeEach(async () => {
    vi.resetModules();
    spawnProcess.mockReset();
    assertProcessHandleOpen.mockReset();
    stopProcess.mockReset();
    restartProcess.mockReset();
    initialiseEngine.mockReset();
    registerEngine.mockReset();
    syncPosition.mockReset();
    startAnalysis.mockReset();
    stopAnalysis.mockReset();
    startPlayerTurn.mockReset();
    awaitPlayerTurnMove.mockReset();
    stopEngine.mockReset();
    spawnProcess.mockResolvedValue('process-1');
    restartProcess.mockResolvedValue('process-2');
    awaitPlayerTurnMove.mockResolvedValue(createMove());
    vi.doMock('@/platform', () => ({
      usePlatformService: () => ({
        getProcessManager: () => ({
          spawnProcess,
          assertProcessHandleOpen,
          stopProcess,
          restartProcess,
        }),
        getEngineClient: () => ({
          initialiseEngine,
          registerEngine,
          syncPosition,
          startAnalysis,
          stopAnalysis,
          startPlayerTurn,
          awaitPlayerTurnMove,
          stopEngine,
          restartEngine: vi.fn(),
          requiresNewGameBoundary: vi.fn(() => false),
        }),
      }),
    }));
    ({ EngineRuntimeService } = await import('..'));
  });

  it('initialises an engine through the mocked platform process manager', async () => {
    const engine = createAssignedEngine();

    await EngineRuntimeService.ensureReady(engine);

    expect(spawnProcess).toHaveBeenCalledWith('stockfish.exe');
    expect(initialiseEngine).toHaveBeenCalledWith(engine);
    expect(engine.$?.processHandle).toBe('process-1');
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });

  it('reinitialises when the mocked process handle is stale during registration', async () => {
    const engine = createAssignedEngine();
    engine.$!.processHandle = 'stale-process';
    assertProcessHandleOpen.mockImplementation(() => {
      throw createInvalidHandleError('Closed handle.');
    });

    await EngineRuntimeService.registerEngine(engine, createRegistrationRequest());

    expect(spawnProcess).toHaveBeenCalledWith('stockfish.exe');
    expect(initialiseEngine).toHaveBeenCalledWith(engine);
    expect(registerEngine).toHaveBeenCalledWith(engine, createRegistrationRequest());
    expect(engine.$?.processHandle).toBe('process-1');
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });

  it('starts analysis with the subscribed callback from the mocked engine client', async () => {
    const engine = createAssignedEngine();
    const onUpdate = vi.fn();
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, onUpdate);
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);

    await EngineRuntimeService.startAnalysis(engine, createAnalysisRequest());

    expect(startAnalysis).toHaveBeenCalledTimes(1);
    expect(startAnalysis.mock.calls[0]?.[0]).toBe(engine);
    expect(startAnalysis.mock.calls[0]?.[1]).toEqual(createAnalysisRequest());
    expect(startAnalysis.mock.calls[0]?.[2]).toBe(onUpdate);
    unsubscribe();
    expect(engine.$?.analysisCallback).toBeUndefined();
  });

  it('stops the engine and clears runtime state through the mocked platform services', async () => {
    const engine = createAssignedEngine();
    engine.$!.processHandle = 'process-1';
    engine.$!.availability = EngineAvailability.Running;
    engine.$!.analysisCallback = vi.fn();
    engine.$!.analysisLines.set(1, { depth: 1, scoreCp: 23, pv: [createMove()] });

    await EngineRuntimeService.stopEngine(engine);

    expect(stopEngine).toHaveBeenCalledWith(engine);
    expect(stopProcess).toHaveBeenCalledWith('process-1');
    expect(engine.$?.processHandle).toBeUndefined();
    expect(engine.$?.analysisCallback).toBeUndefined();
    expect(engine.$?.analysisLines.size).toBe(0);
    expect(engine.$?.availability).toBe(EngineAvailability.Unavailable);
  });
});
