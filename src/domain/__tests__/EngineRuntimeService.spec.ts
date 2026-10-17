import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

import {
  EngineAnalysisSearchMode,
  EngineAvailability,
  EngineClientType,
  EngineOptionType,
  EngineProtocol,
  MoveKind,
  PieceKind,
  PlatformErrorKind,
  PlayerColour,
  ResultState,
  type IAssignedEngine,
  type IBoardPosition,
  type IEngineAnalysisRequest,
  type IEngineAnalysisUpdate,
  type IEngineRecord,
  type IGame,
  type IMove,
} from '@/contracts';
import { applyMove, createInitialBoardPosition, genDetailedMoves } from '@/utility/chess';
import { parseUciMove } from '@/utility/UciUtility';
import { Deferred } from '@/utility/async/Deferred';
let Aborted: typeof import('@/contracts/errors/Aborted').default;

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
    ({ default: Aborted } = await import('@/contracts/errors/Aborted'));
  });

  it('initialises an engine through the mocked platform process manager', async () => {
    const engine = createAssignedEngine();

    await EngineRuntimeService.ensureReady(engine);

    expect(spawnProcess).toHaveBeenCalledWith('stockfish.exe');
    expect(initialiseEngine).toHaveBeenCalledWith(engine);
    expect(engine.$?.processHandle).toBe('process-1');
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });
  it('rejects missing analysis base runtime through the existing promise contract', async () => {
    const engine = createAssignedEngine();
    delete engine.$;
    await expect(EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest())).rejects.toThrow('Engine runtime state is not available');
    expect(spawnProcess).not.toHaveBeenCalled();
  });
  it('cancels superseded analysis readiness and starts only the latest request', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const ready = new Deferred<void>();
    initialiseEngine.mockImplementationOnce(() => { entered.resolve(); return ready; });
    const first = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const intermediate = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    const secondGame = createGame();
    const second = EngineRuntimeService.startAnalysis(engine, secondGame, createAnalysisRequest());
    expect(await first).toBeInstanceOf(Aborted);
    expect(await intermediate).toBeInstanceOf(Aborted);
    expect(startAnalysis).not.toHaveBeenCalled();
    ready.resolve();
    await second;
    expect(startAnalysis).toHaveBeenCalledOnce();
    expect(startAnalysis.mock.calls[0]?.[1]).toBe(secondGame);
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
  });
  it('rejects old output after resubscription and leaves the replacement status intact', async () => {
    const engine = createAssignedEngine();
    const oldSubscriber = vi.fn();
    const subscriber = vi.fn();
    const update: IEngineAnalysisUpdate = { position: createInitialBoardPosition(), lines: [], isFinal: true };
    EngineRuntimeService.subscribeToAnalysis(engine, oldSubscriber);
    await EngineRuntimeService.ensureReady(engine);
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    const oldCallback = startAnalysis.mock.calls[0]![3];
    EngineRuntimeService.subscribeToAnalysis(engine, subscriber);
    expect(oldCallback(update)).toBe(false);
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(oldCallback(update)).toBe(false);
    expect(oldSubscriber).not.toHaveBeenCalled();
    expect(subscriber).not.toHaveBeenCalled();
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
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

  it('guards analysis moves before forwarding updates from the mocked engine client', async () => {
    const engine = createAssignedEngine();
    const position = createInitialBoardPosition();
    const game = createGame(position);
    const onUpdate = vi.fn();
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, onUpdate);
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);

    await EngineRuntimeService.startAnalysis(engine, game, createAnalysisRequest());

    expect(startAnalysis).toHaveBeenCalledTimes(1);
    expect(startAnalysis.mock.calls[0]?.[0]).toBe(engine);
    expect(startAnalysis.mock.calls[0]?.[1]).toBe(game);
    expect(startAnalysis.mock.calls[0]?.[2]).toEqual(createAnalysisRequest());
    const guardedOnUpdate = startAnalysis.mock.calls[0]?.[3] as (update: IEngineAnalysisUpdate) => boolean;
    const validUpdate: IEngineAnalysisUpdate = { position, lines: [{ depth: 1, pv: [createMove(), createPonderMove()] }], isFinal: false };
    const illegalPvMove: IMove = { from: boardId(4, 3), to: boardId(4, 4), kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn };
    const illegalBestMove: IMove = { ...createMove(), to: boardId(4, 4) };

    expect(guardedOnUpdate(validUpdate)).toBe(true);
    expect(guardedOnUpdate({ ...validUpdate, lines: [{ depth: 2, pv: [...validUpdate.lines[0]!.pv, illegalPvMove] }] })).toBe(false);
    expect(guardedOnUpdate({ ...validUpdate, bestMove: illegalBestMove, isFinal: true })).toBe(false);
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(validUpdate);
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
  it('commits the engine move without pondering a predicted checkmate', async () => {
    const engine = createAssignedEngine();
    const position = createInitialBoardPosition();
    for (const move of genDetailedMoves(position, ['f2f3', 'e7e5'].map(parseUciMove))) applyMove(position, move);
    const [move, ponderMove] = genDetailedMoves(position, ['g2g4', 'd8h4'].map(parseUciMove));
    move!.$ = { ponderMove };
    engine.$!.processHandle = 'process-1';
    assertProcessHandleOpen.mockReturnValue(undefined);
    awaitPlayerTurnMove.mockResolvedValue(move);
    const attemptPlayerMove = vi.fn(async () => undefined);
    await EngineRuntimeService.startPlayerTurn(engine, createGame(position), attemptPlayerMove);
    expect(attemptPlayerMove).toHaveBeenCalledExactlyOnceWith(move);
    expect(startPondering).not.toHaveBeenCalled();
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });

  it('drains an issued start before replacement and suppresses its late error and output', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const started = new Deferred<void>();
    startAnalysis.mockImplementationOnce(() => { entered.resolve(); return started; });
    const first = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const oldCallback = startAnalysis.mock.calls[0]![3];
    const replacement = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(await first).toBeInstanceOf(Aborted);
    expect(startAnalysis).toHaveBeenCalledOnce();
    expect(oldCallback({ position: createInitialBoardPosition(), lines: [], isFinal: true })).toBe(false);
    expect(engine.$?.availability).toBe(EngineAvailability.Starting);
    started.reject(new Error('obsolete startup failure'));
    await replacement;
    expect(startAnalysis).toHaveBeenCalledTimes(2);
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
    expect(engine.$?.lastError).toBeUndefined();
  });
  it('cancels readiness on Stop without sending an analysis start or stop command', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const ready = new Deferred<void>();
    initialiseEngine.mockImplementationOnce(() => { entered.resolve(); return ready; });
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const stopping = EngineRuntimeService.stopAnalysis(engine);
    expect(await starting).toBeInstanceOf(Aborted);
    ready.resolve();
    await stopping;
    expect(startAnalysis).not.toHaveBeenCalled();
    expect(stopAnalysis).not.toHaveBeenCalled();
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
  });
  it('waits for a stopping search before starting a replacement', async () => {
    const engine = createAssignedEngine();
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    const entered = new Deferred<void>();
    const stopped = new Deferred<void>();
    stopAnalysis.mockImplementationOnce(() => { entered.resolve(); return stopped; });
    const stopping = EngineRuntimeService.stopAnalysis(engine).catch((error) => error);
    await entered;
    const replacement = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(await stopping).toBeInstanceOf(Aborted);
    expect(startAnalysis).toHaveBeenCalledOnce();
    stopped.resolve();
    await replacement;
    expect(startAnalysis).toHaveBeenCalledTimes(2);
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
  });
  it.each(['player', 'analysis'])('retains typed platform startup feedback for %s engines', async (kind) => {
    const engine = createAssignedEngine();
    const error = { kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Engine unavailable. Choose another player.' };
    spawnProcess.mockRejectedValueOnce(error);
    const starting = kind === 'player' ? EngineRuntimeService.ensureReady(engine) : EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    await expect(starting).rejects.toBe(error);
    expect(engine.$?.availability).toBe(EngineAvailability.Failed);
    expect(engine.$?.lastError).toBe(error.message);
  });
  it('clears a stale process handle when stopping analysis fails its liveness check', async () => {
    const engine = createAssignedEngine();
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    const error = Object.assign(new Error('Process closed'), { kind: PlatformErrorKind.InvalidProcessHandle, operation: 'assertProcessHandleOpen' });
    assertProcessHandleOpen.mockImplementationOnce(() => { throw error; });
    await expect(EngineRuntimeService.stopAnalysis(engine)).rejects.toBe(error);
    expect(stopAnalysis).not.toHaveBeenCalled();
    expect(engine.$?.processHandle).toBeUndefined();
    expect(engine.$?.availability).toBe(EngineAvailability.Failed);
    expect(engine.$?.lastError).toBe('Process closed');
  });
  it('releases a process spawned after removal without initialising its client', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const spawned = new Deferred<string>();
    spawnProcess.mockImplementationOnce(() => { entered.resolve(); return spawned; });
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const disposal = EngineRuntimeService.stopEngine(engine);
    expect(await starting).toBeInstanceOf(Aborted);
    spawned.resolve('late-process');
    await disposal;
    expect(stopProcess).toHaveBeenCalledWith('late-process');
    expect(initialiseEngine).not.toHaveBeenCalled();
    expect(startAnalysis).not.toHaveBeenCalled();
    expect(engine.$?.processHandle).toBeUndefined();
    expect(engine.$?.availability).toBe(EngineAvailability.Unavailable);
  });
  it('preserves natural completion received before the startup promise resolves', async () => {
    const engine = createAssignedEngine();
    startAnalysis.mockImplementationOnce((_engine, _game, _request, onUpdate) => {
      onUpdate({ position: createInitialBoardPosition(), lines: [], isFinal: true });
    });
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
    await EngineRuntimeService.stopAnalysis(engine);
    expect(stopAnalysis).not.toHaveBeenCalled();
  });
  it.each(['stopEngine', 'restartEngine'] as const)('reuses a late spawn when %s is superseded before shutdown starts', async (terminalAction) => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const spawned = new Deferred<string>();
    spawnProcess.mockImplementationOnce(() => { entered.resolve(); return spawned; });
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const disposal = EngineRuntimeService[terminalAction](engine).catch((error) => error);
    const replacement = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(await starting).toBeInstanceOf(Aborted);
    expect(await disposal).toBeInstanceOf(Aborted);
    expect(initialiseEngine).not.toHaveBeenCalled();
    spawned.resolve('late-process');
    await replacement;
    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(stopProcess).not.toHaveBeenCalled();
    expect(stopEngine).not.toHaveBeenCalled();
    expect(initialiseEngine).toHaveBeenCalledOnce();
    expect(startAnalysis).toHaveBeenCalledOnce();
    expect(engine.$?.processHandle).toBe('late-process');
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
  });
  it('waits for issued shutdown and interrupted client work before starting another search', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const ready = new Deferred<void>();
    const shutdownEntered = new Deferred<void>();
    const stopped = new Deferred<void>();
    initialiseEngine.mockImplementationOnce(() => { entered.resolve(); return ready; });
    spawnProcess.mockResolvedValueOnce('process-1').mockResolvedValue('process-2');
    stopProcess.mockImplementationOnce(() => { shutdownEntered.resolve(); return stopped; });
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    const disposal = EngineRuntimeService.stopEngine(engine).catch((error) => error);
    await shutdownEntered;
    const restart = EngineRuntimeService.restartEngine(engine).catch((error) => error);
    await flushPromises();
    expect(stopProcess).toHaveBeenCalledOnce();
    const replacement = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(await starting).toBeInstanceOf(Aborted);
    expect(await disposal).toBeInstanceOf(Aborted);
    expect(await restart).toBeInstanceOf(Aborted);
    expect(stopEngine).not.toHaveBeenCalled();
    stopped.resolve();
    await flushPromises();
    expect(stopEngine).toHaveBeenCalledOnce();
    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(startAnalysis).not.toHaveBeenCalled();
    ready.reject(new Error('Process exited during readiness.'));
    await replacement;
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(startAnalysis).toHaveBeenCalledOnce();
    expect(engine.$?.processHandle).toBe('process-2');
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
  });
  it('retains the client wait and handle when physical shutdown fails', async () => {
    const engine = createAssignedEngine();
    const entered = new Deferred<void>();
    const ready = new Deferred<void>();
    initialiseEngine.mockImplementationOnce(() => { entered.resolve(); return ready; });
    stopProcess.mockRejectedValueOnce(new Error('Shutdown failed.'));
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest()).catch((error) => error);
    await entered;
    await expect(EngineRuntimeService.stopEngine(engine)).rejects.toThrow('Shutdown failed.');
    expect(await starting).toBeInstanceOf(Aborted);
    expect(engine.$?.availability).toBe(EngineAvailability.Failed);
    expect(engine.$?.processHandle).toBe('process-1');
    expect(stopEngine).not.toHaveBeenCalled();
    const replacement = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    await flushPromises();
    expect(initialiseEngine).toHaveBeenCalledOnce();
    expect(startAnalysis).not.toHaveBeenCalled();
    ready.resolve();
    await replacement;
    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(stopEngine).not.toHaveBeenCalled();
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
    expect(engine.$?.lastError).toBeUndefined();
  });
  it('starts a later request after the current startup fails without poisoning the queue', async () => {
    const engine = createAssignedEngine();
    startAnalysis.mockRejectedValueOnce(new Error('Startup failed.'));
    await expect(EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest())).rejects.toThrow('Startup failed.');
    expect(engine.$?.availability).toBe(EngineAvailability.Failed);
    expect(startAnalysis.mock.calls[0]![3]({ position: createInitialBoardPosition(), lines: [], isFinal: true })).toBe(false);
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(startAnalysis).toHaveBeenCalledTimes(2);
    expect(engine.$?.availability).toBe(EngineAvailability.Running);
    expect(engine.$?.lastError).toBeUndefined();
  });
  it('preserves a reused subscription when a new start follows pending engine disposal', async () => {
    const engine = createAssignedEngine();
    const subscriber = vi.fn();
    EngineRuntimeService.subscribeToAnalysis(engine, subscriber);
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    const entered = new Deferred<void>();
    const stopped = new Deferred<void>();
    stopProcess.mockImplementationOnce(() => { entered.resolve(); return stopped; });
    const disposal = EngineRuntimeService.stopEngine(engine).catch((error) => error);
    await entered;
    const starting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    expect(await disposal).toBeInstanceOf(Aborted);
    stopped.resolve();
    await starting;
    const onUpdate = startAnalysis.mock.calls[1]![3];
    const update = { position: createInitialBoardPosition(), lines: [], isFinal: false };
    expect(onUpdate(update)).toBe(true);
    expect(subscriber).toHaveBeenCalledWith(update);
  });
  it('starts another assigned engine while the first waits for readiness', async () => {
    const engine = createAssignedEngine();
    const peer = createAssignedEngine();
    const entered = new Deferred<void>();
    const ready = new Deferred<void>();
    initialiseEngine.mockImplementationOnce(() => { entered.resolve(); return ready; });
    const waiting = EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    await entered;
    await EngineRuntimeService.startAnalysis(peer, createGame(), createAnalysisRequest());
    expect(startAnalysis.mock.calls[0]![0]).toBe(peer);
    ready.resolve();
    await waiting;
    expect(startAnalysis.mock.calls[1]![0]).toBe(engine);
  });
  it('validates lines beyond the three rendered ranks', async () => {
    const engine = createAssignedEngine();
    const subscriber = vi.fn();
    EngineRuntimeService.subscribeToAnalysis(engine, subscriber);
    await EngineRuntimeService.startAnalysis(engine, createGame(), createAnalysisRequest());
    const onUpdate = startAnalysis.mock.calls[0]![3];
    const lines = [1, 2, 3].map(() => ({ depth: 1, pv: [createMove()] }));
    lines.push({ depth: 1, pv: [{ ...createMove(), to: boardId(4, 4) }] });
    expect(onUpdate({ position: createInitialBoardPosition(), lines, isFinal: false })).toBe(false);
    expect(subscriber).not.toHaveBeenCalled();
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
