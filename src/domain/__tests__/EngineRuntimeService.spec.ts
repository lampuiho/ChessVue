import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineOptionType,
  EngineProtocol,
  MoveKind,
  PieceKind,
  PlayerColour,
  ResultState,
  type IAssignedEngine,
  type IBoardPosition,
  type IEngineAnalysisRequest,
  type IEngineRecord,
  type IGame,
  type IMove,
} from '@/contracts';
import { createInitialBoardPosition } from '@/utility/chess';

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
function createEngineRecord(): IEngineRecord {
  return {
    id: 'engine-a',
    displayName: 'Stockfish',
    executablePath: 'stockfish.exe',
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 4 },
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
    movingPiece: PieceKind.Pawn,
  };
}
function createPonderMove(): IMove {
  return {
    from: boardId(4, 6),
    to: boardId(4, 4),
    kind: MoveKind.Normal,
    movingColour: PlayerColour.Black,
    movingPiece: PieceKind.Pawn,
  };
}
function createGame(position: IBoardPosition = createInitialBoardPosition()): IGame {
  return {
    metadata: { id: 'game-1' },
    resultState: ResultState.Ongoing,
    $: { livePosition: position },
  } as IGame;
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

  it('discovers copied option metadata through a temporary engine and closes it before returning', async () => {
    const engineProfile = createEngineRecord();
    const discoveredOptions = [
      { name: 'Threads', type: EngineOptionType.Integer, defaultValue: 1, minimum: 1, maximum: 1024 },
      { name: 'Style', type: EngineOptionType.Choice, defaultValue: 'Normal', choices: ['Normal', 'Risky'] },
    ];
    getOptions.mockReturnValue(discoveredOptions);

    const options = await EngineRuntimeService.getOptions(engineProfile);

    const runtimeEngine = initialiseEngine.mock.calls[0]?.[0] as IAssignedEngine;
    expect(runtimeEngine).not.toBe(engineProfile);
    expect(runtimeEngine).toMatchObject({
      displayName: engineProfile.displayName,
      executablePath: engineProfile.executablePath,
      clientType: engineProfile.clientType,
      protocol: engineProfile.protocol,
      options: engineProfile.options,
    });
    expect(runtimeEngine.options).not.toBe(engineProfile.options);
    expect(getOptions).toHaveBeenCalledWith(runtimeEngine);
    expect(stopEngine).toHaveBeenCalledWith(runtimeEngine);
    expect(stopProcess).toHaveBeenCalledWith('process-1');
    expect(runtimeEngine.$?.processHandle).toBeUndefined();
    expect(options).toEqual(discoveredOptions);
    expect(options).not.toBe(discoveredOptions);
    expect(options[1]?.choices).not.toBe(discoveredOptions[1]?.choices);
    expect(engineProfile.options).toEqual({ Threads: 4 });
  });

  it('closes a temporary option-discovery runtime when reading metadata fails', async () => {
    const engineProfile = createEngineRecord();
    getOptions.mockImplementation(() => { throw new Error('option discovery failed'); });

    await expect(EngineRuntimeService.getOptions(engineProfile)).rejects.toThrow('option discovery failed');

    const runtimeEngine = initialiseEngine.mock.calls[0]?.[0] as IAssignedEngine;
    expect(stopEngine).toHaveBeenCalledWith(runtimeEngine);
    expect(stopProcess).toHaveBeenCalledWith('process-1');
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

  it('starts pondering with the canonical game and move sequence', async () => {
    const engine = createAssignedEngine();
    const game = {} as IGame;
    const engineMove = createMove();
    const ponderMove = createPonderMove();
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);

    await EngineRuntimeService.startPondering(engine, game, engineMove, ponderMove);

    expect(startPondering).toHaveBeenCalledWith(engine, game, engineMove, ponderMove);
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });

  it('starts pondering before the shared move attempt finishes', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const move = createMove();
    const ponderMove = createPonderMove();
    const events: string[] = [];
    let finishAttempt: (() => void) | undefined;
    move.$ = { ponderMove };
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    startPlayerTurn.mockImplementation(async () => { events.push('start'); });
    awaitPlayerTurnMove.mockImplementation(async () => { events.push('await'); return move; });
    startPondering.mockImplementation(async () => { events.push('ponder'); });
    const attemptPlayerMove = vi.fn(async () => {
      events.push('attempt');
      await new Promise<void>((resolve) => { finishAttempt = resolve; });
      events.push('committed');
    });

    const turn = EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove);
    await vi.waitFor(() => expect(events).toEqual(['start', 'await', 'ponder', 'attempt']));
    expect(startPondering).toHaveBeenCalledWith(engine, game, move, ponderMove);
    finishAttempt!();
    await turn;

    expect(events).toEqual(['start', 'await', 'ponder', 'attempt', 'committed']);
    expect(attemptPlayerMove).toHaveBeenCalledOnce();
  });
  it('returns from an awaited player move when its turn signal is aborted', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const abortController = new AbortController();
    const attemptPlayerMove = vi.fn();
    let rejectPlayerMove!: (error: Error) => void;
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockReturnValue(new Promise<IMove>((_resolve, reject) => { rejectPlayerMove = reject; }));

    const turn = EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove, abortController.signal);
    await vi.waitFor(() => expect(awaitPlayerTurnMove).toHaveBeenCalledOnce());
    abortController.abort();
    rejectPlayerMove(new Error('Engine stopped.'));
    await expect(turn).resolves.toBeUndefined();

    expect(attemptPlayerMove).not.toHaveBeenCalled();
    expect(startPondering).not.toHaveBeenCalled();
  });

  it('rejects an illegal best move before pondering or attempting it', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const attemptPlayerMove = vi.fn();
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue({ ...createMove(), to: boardId(4, 4) });

    await expect(EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove)).rejects.toThrow('illegal move');

    expect(startPondering).not.toHaveBeenCalled();
    expect(attemptPlayerMove).not.toHaveBeenCalled();
  });

  it('rejects an illegal ponder move before pondering or attempting the best move', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const move = createMove();
    const attemptPlayerMove = vi.fn();
    move.$ = { ponderMove: { ...createPonderMove(), to: boardId(4, 3) } };
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue(move);

    await expect(EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove)).rejects.toThrow('illegal ponder move');

    expect(startPondering).not.toHaveBeenCalled();
    expect(attemptPlayerMove).not.toHaveBeenCalled();
  });

  it('attempts a legal move once without starting absent pondering', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const move = createMove();
    const attemptPlayerMove = vi.fn(async () => undefined);
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue(move);

    await EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove);

    expect(attemptPlayerMove).toHaveBeenCalledOnce();
    expect(attemptPlayerMove).toHaveBeenCalledWith(move);
    expect(startPondering).not.toHaveBeenCalled();
  });

  it('attempts a legal move without pondering after the game has ended', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const move = createMove();
    const ponderMove = createPonderMove();
    const attemptPlayerMove = vi.fn(async () => undefined);
    game.resultState = ResultState.Drawn;
    move.$ = { ponderMove };
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue(move);

    await EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove);

    expect(attemptPlayerMove).toHaveBeenCalledOnce();
    expect(startPondering).not.toHaveBeenCalled();
  });

  it('keeps the move attempt when starting pondering fails', async () => {
    const engine = createAssignedEngine();
    const game = createGame();
    const move = createMove();
    const attemptPlayerMove = vi.fn(async () => undefined);
    move.$ = { ponderMove: createPonderMove() };
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue(move);
    startPondering.mockRejectedValue(new Error('ponder boom'));

    await expect(EngineRuntimeService.startPlayerTurn(engine, game, attemptPlayerMove)).resolves.toBeUndefined();

    expect(attemptPlayerMove).toHaveBeenCalledOnce();
    expect(engine.$?.availability).toBe(EngineAvailability.Failed);
    expect(engine.$?.lastError).toBe('ponder boom');
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
