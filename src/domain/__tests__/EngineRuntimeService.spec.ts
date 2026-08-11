import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  MoveKind,
  PlayerColour,
  type IAssignedEngine,
  type IEngineAnalysisRequest,
  type IGame,
  type IMove,
} from '@/contracts';

let EngineRuntimeService: typeof import('..').EngineRuntimeService;
const spawnProcess = vi.fn();
const assertProcessHandleOpen = vi.fn();
const stopProcess = vi.fn();
const restartProcess = vi.fn();
const initialiseEngine = vi.fn();
const getOptions = vi.fn();
const startAnalysis = vi.fn();
const stopAnalysis = vi.fn();
const startPlayerTurn = vi.fn();
const startPondering = vi.fn();
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
function createMove(): IMove {
  return {
    from: boardId(4, 1),
    to: boardId(4, 3),
    kind: MoveKind.Normal,
    movingColour: PlayerColour.White,
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
    getOptions.mockReset();
    startAnalysis.mockReset();
    stopAnalysis.mockReset();
    startPlayerTurn.mockReset();
    startPondering.mockReset();
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
          getOptions,
          initialiseEngine,
          startAnalysis,
          stopAnalysis,
          startPlayerTurn,
          startPondering,
          awaitPlayerTurnMove,
          stopEngine,
          restartEngine: vi.fn(),
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

  it('starts analysis with the subscribed callback from the mocked engine client', async () => {
    const engine = createAssignedEngine();
    const game = {} as IGame;
    const onUpdate = vi.fn();
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, onUpdate);
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);

    await EngineRuntimeService.startAnalysis(engine, game, createAnalysisRequest());

    expect(startAnalysis).toHaveBeenCalledTimes(1);
    expect(startAnalysis.mock.calls[0]?.[0]).toBe(engine);
    expect(startAnalysis.mock.calls[0]?.[1]).toBe(game);
    expect(startAnalysis.mock.calls[0]?.[2]).toEqual(createAnalysisRequest());
    expect(startAnalysis.mock.calls[0]?.[3]).toBe(onUpdate);
    unsubscribe();
    expect(engine.$?.analysisCallback).toBeUndefined();
  });

  it('starts pondering with the canonical game and expected move', async () => {
    const engine = createAssignedEngine();
    const game = {} as IGame;
    const move = createMove();
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);

    await EngineRuntimeService.startPondering(engine, game, move);

    expect(startPondering).toHaveBeenCalledWith(engine, game, move);
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
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
