import { EngineAvailability, PlatformError, PlatformErrorKind, ResultState, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisOperation, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEngineOptionMeta, type IEngineRecord, type IGame, type IMove, type IMoveCandidate, type IMoveRaw, type IPlatformError } from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { Deferred } from '@/utility/async/Deferred';
import { usePlatformService } from '@/platform';
import { isMoveLegal, resolveGameResult } from '@/utility/chess';
import { isPlatformError } from '@/utility/errors/StandardErrorHandlingUtility';
import { MoveApplicationService } from './MoveApplicationService';

type IRuntimeAssignedEngine = IAssignedEngine & { $: IAssignedEngineRuntime };

function _canPonder(position: IBoardPosition, move: IMoveCandidate, ponderMove: IMoveCandidate): boolean {
  const predictedPosition = MoveApplicationService.genPosition(position, [move, ponderMove]);
  return resolveGameResult(predictedPosition).resultState === ResultState.Ongoing;
}

function _hasRuntimeState(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return !!engine.$;
}
function _getRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime | undefined {
  return engine.$;
}
function _ensureAnalysisState(runtimeState: IAssignedEngineRuntime): IAssignedEngineRuntime {
  if (!(runtimeState.analysisLines instanceof Map)) runtimeState.analysisLines = new Map();
  return runtimeState;
}
function _createBaseRuntime(engine: IAssignedEngine): IAssignedEngineRuntime {
  if (_hasRuntimeState(engine)) return _ensureAnalysisState(engine.$);
  const runtimeEngine = engine as IRuntimeAssignedEngine;
  runtimeEngine.$ = { availability: EngineAvailability.Unavailable, analysisLines: new Map() };
  if (_hasRuntimeState(runtimeEngine)) return runtimeEngine.$;
  throw new Error(`Failed to initialise runtime state for ${engine.displayName}.`);
}
function _createAssignedEngine(engineProfile: IEngineRecord): IAssignedEngine {
  return {
    displayName: engineProfile.displayName,
    entryPath: engineProfile.entryPath,
    clientType: engineProfile.clientType,
    options: { ...engineProfile.options },
  };
}
function _copyOptionMeta(option: IEngineOptionMeta): IEngineOptionMeta {
  return option.choices === undefined ? { ...option } : { ...option, choices: [...option.choices] };
}
function _assertBaseRuntime(engine: IAssignedEngine): IAssignedEngineRuntime {
  const runtimeState = _getRuntimeState(engine);
  if (runtimeState) return _ensureAnalysisState(runtimeState);
  throw new Error(`Engine runtime state is not available for ${engine.displayName}.`);
}
function _setRuntimeAvailability(runtimeState: IAssignedEngineRuntime, availability: EngineAvailability, lastError?: string) {
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
}
function _clearAnalysisState(runtimeState: IAssignedEngineRuntime) {
  runtimeState.analysisLines.clear();
  runtimeState.analysisNeedsStop = false;
}
function _isMoveSequenceLegal(position: IBoardPosition, moves: readonly IMoveCandidate[]): boolean {
  const currentPosition = MoveApplicationService.genPosition(position, []);
  for (const move of moves) {
    if (!isMoveLegal(currentPosition, move)) return false;
    MoveApplicationService.applyMove(currentPosition, move);
  }
  return true;
}
function _isAnalysisUpdateLegal(update: IEngineAnalysisUpdate): boolean {
  const position = update.position as IBoardPosition;
  if (update.bestMove && !isMoveLegal(position, update.bestMove)) return false;
  return update.lines.every((line) => _isMoveSequenceLegal(position, line.pv as readonly IMoveCandidate[]));
}
function _acceptAnalysisUpdate(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation, update: IEngineAnalysisUpdate): boolean {
  if (operation.abortController.signal.aborted || operation.isFinal) return false;
  if (!_isAnalysisUpdateLegal(update)) return false;
  operation.isFinal = update.isFinal;
  if (update.isFinal) runtimeState.analysisNeedsStop = false;
  _setRuntimeAvailability(runtimeState, update.isFinal ? EngineAvailability.Ready : EngineAvailability.Running);
  return true;
}
function _beginAnalysisOperation(runtimeState: IAssignedEngineRuntime): IEngineAnalysisOperation {
  const previous = runtimeState.analysisOperation;
  if (previous) {
    const error = new Aborted('Analysis was superseded.');
    previous.abortController.abort(error);
    previous.completion.reject(error);
  }
  const operation = { abortController: new AbortController(), completion: new Deferred<void>(), isFinal: false };
  void operation.completion.catch(() => undefined);
  runtimeState.analysisOperation = operation;
  return operation;
}
function _failAnalysisOperation(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation, error: unknown) {
  const signal = operation.abortController.signal;
  if (signal.aborted) {
    operation.completion.reject(signal.reason);
    return;
  }
  if (_isInvalidProcessHandleError(error)) runtimeState.process = undefined;
  if (!(error instanceof Aborted)) _setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error || isPlatformError(error) ? error.message : 'Unknown engine runtime failure.');
  operation.completion.reject(error);
  operation.abortController.abort(error);
}
function _queueAnalysisOperation(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation, action: (signal: AbortSignal) => Promise<void>) {
  const previousWork = runtimeState.analysisWork ?? Promise.resolve();
  const signal = operation.abortController.signal;
  runtimeState.analysisWork = (async () => {
    try {
      await previousWork;
      signal.throwIfAborted();
      await action(signal);
      signal.throwIfAborted();
      operation.completion.resolve();
    } catch (error) {
      _failAnalysisOperation(runtimeState, operation, error);
    }
  })();
  return operation.completion;
}
async function _runAnalysisClientWork<T>(runtimeState: IAssignedEngineRuntime, action: () => Promise<T>): Promise<T> {
  const completion = new Deferred<void>();
  runtimeState.analysisClientWork = completion;
  try {
    return await action();
  } finally {
    runtimeState.analysisClientWork = undefined;
    completion.resolve();
  }
}
function _isInvalidProcessHandleError(error: unknown): boolean {
  return isPlatformError(error) && error.kind === PlatformErrorKind.InvalidProcessHandle;
}
function _createEngineNotInitialisedError(engine: IAssignedEngine): IPlatformError {
  return new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'engineRuntime', message: `Engine process is not initialised for ${engine.displayName}.` });
}
async function _initialiseEngine(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, signal?: AbortSignal) {
  const processManager = usePlatformService().getProcessManager(engine.clientType);
  _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  try {
    if (!runtimeState.process) runtimeState.process = await processManager.spawnProcess(engine.entryPath);
    else processManager.assertProcessOpen(runtimeState.process);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
    runtimeState.process = await processManager.spawnProcess(engine.entryPath);
  }
  if (!signal?.aborted) await _runAnalysisClientWork(runtimeState, () => _getEngineClient(engine).initialiseEngine(engine));
}
function _assertProcessOpen(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime) {
  const process = runtimeState.process;
  if (!process) throw _createEngineNotInitialisedError(engine);
  usePlatformService().getProcessManager(engine.clientType).assertProcessOpen(process);
}
function _getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function _runEngineOperation<T>(runtimeState: IAssignedEngineRuntime, successAvailability: EngineAvailability, operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    const result = await operation();
    if (!signal?.aborted) _setRuntimeAvailability(runtimeState, successAvailability);
    return result;
  } catch (error) {
    if (!signal?.aborted) {
      if (_isInvalidProcessHandleError(error)) runtimeState.process = undefined;
      _setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error || isPlatformError(error) ? error.message : 'Unknown engine runtime failure.');
    }
    throw error;
  }
}
async function _runInitialisedEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  const runtimeState = _assertBaseRuntime(engine);
  return _runEngineOperation(runtimeState, successAvailability, async () => {
    try {
      _assertProcessOpen(engine, runtimeState);
      return await operation();
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
      await _initialiseEngine(engine, runtimeState);
      return operation();
    }
  });
}
async function _runLiveEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  const runtimeState = _assertBaseRuntime(engine);
  return _runEngineOperation(runtimeState, successAvailability, async () => {
    _assertProcessOpen(engine, runtimeState);
    return operation();
  });
}
async function _stopClientSession(engine: IAssignedEngine) {
  try {
    await _getEngineClient(engine).stopEngine(engine);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
  }
}
async function _releaseEngineProcess(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime) {
  const process = runtimeState.process;
  if (process) {
    try {
      await usePlatformService().getProcessManager(engine.clientType).stopProcess(process);
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
    }
    // Keep response contexts intact until physical shutdown succeeds or the handle is already closed.
    await _stopClientSession(engine);
  }
  runtimeState.process = undefined;
  _clearAnalysisState(runtimeState);
}
async function _stopEngineProcess(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime) {
  if (runtimeState.analysisShutdownWork) return runtimeState.analysisShutdownWork;
  const work = _releaseEngineProcess(engine, runtimeState);
  runtimeState.analysisShutdownWork = work;
  try {
    await work;
  } finally {
    runtimeState.analysisShutdownWork = undefined;
  }
}
async function _restartEngineProcess(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, signal: AbortSignal) {
  await _stopEngineProcess(engine, runtimeState);
  signal.throwIfAborted();
  await EngineRuntimeService.ensureReady(engine, signal);
}
function _queueEngineDisposal(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, restart: boolean) {
  const operation = _beginAnalysisOperation(runtimeState);
  const onUpdate = runtimeState.analysisCallback;
  const previousWork = runtimeState.analysisWork;
  const clientWork = runtimeState.analysisClientWork;
  // Only physical shutdown can release a blocked client wait; superseded, unissued teardown is skipped.
  const interruption = Promise.resolve().then(async () => {
    if (operation.abortController.signal.aborted || !clientWork) return;
    await _stopEngineProcess(engine, runtimeState);
  }).catch((error: unknown) => _failAnalysisOperation(runtimeState, operation, error));
  runtimeState.analysisWork = Promise.all([previousWork, clientWork, interruption]).then(() => undefined);
  if (restart) _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  return _queueAnalysisOperation(runtimeState, operation, async (signal) => {
    if (restart) await _restartEngineProcess(engine, runtimeState, signal);
    else {
      await _stopEngineProcess(engine, runtimeState);
      signal.throwIfAborted();
      _setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
      if (runtimeState.analysisCallback === onUpdate) runtimeState.analysisCallback = undefined;
    }
  });
}

export const EngineRuntimeService = {
  /** Creates engine.$ without starting a process and retains any existing runtime. */
  ensureRuntime(engine: IAssignedEngine): IAssignedEngineRuntime {
    return _createBaseRuntime(engine);
  },
  /** Runs a temporary engine session, copies its discovered option metadata, and closes the session before returning. */
  async getOptions(engineProfile: IEngineRecord): Promise<readonly IEngineOptionMeta[]> {
    const engine = _createAssignedEngine(engineProfile);
    let options: readonly IEngineOptionMeta[] = [];
    try {
      await EngineRuntimeService.ensureReady(engine);
      options = _getEngineClient(engine).getOptions(engine).map(_copyOptionMeta);
    } finally {
      await EngineRuntimeService.stopEngine(engine);
    }
    return options;
  },
  /** Mutates engine.$ by creating or refreshing runtime state, including process, availability, and lastError. */
  async ensureReady(engine: IAssignedEngine, signal?: AbortSignal) {
    if (signal?.aborted) return;
    const runtimeState = _createBaseRuntime(engine);
    try {
      await _runEngineOperation(runtimeState, EngineAvailability.Ready, async () => {
        await _initialiseEngine(engine, runtimeState, signal);
      }, signal);
    } catch (error) {
      if (!signal?.aborted) throw error;
    }
  },
  /** Supersedes pending analysis and owns readiness, startup, and the guarded streaming callback. */
  async startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest) {
    const runtimeState = _assertBaseRuntime(engine);
    const operation = _beginAnalysisOperation(runtimeState);
    const onUpdate = runtimeState.analysisCallback;
    _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
    return _queueAnalysisOperation(runtimeState, operation, async (signal) => {
      await EngineRuntimeService.ensureReady(engine, signal);
      signal.throwIfAborted();
      _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
      runtimeState.analysisNeedsStop = true;
      await _runAnalysisClientWork(runtimeState, () => _getEngineClient(engine).startAnalysis(engine, game, request, (update) => {
        if (runtimeState.analysisCallback !== onUpdate || !_acceptAnalysisUpdate(runtimeState, operation, update)) return false;
        onUpdate?.(update);
        return true;
      }));
      signal.throwIfAborted();
      if (!operation.isFinal) _setRuntimeAvailability(runtimeState, EngineAvailability.Running);
    });
  },
  /** May mutate engine.$ by updating runtime availability when the process handle is stale or the stop fails. */
  async stopAnalysis(engine: IAssignedEngine) {
    const runtimeState = _getRuntimeState(engine);
    if (!runtimeState) return Promise.resolve();
    const operation = _beginAnalysisOperation(runtimeState);
    return _queueAnalysisOperation(runtimeState, operation, async (signal) => {
      if (runtimeState.analysisNeedsStop && runtimeState.process) {
        _assertProcessOpen(engine, runtimeState);
        await _runAnalysisClientWork(runtimeState, () => _getEngineClient(engine).stopAnalysis(engine));
      }
      runtimeState.analysisNeedsStop = false;
      signal.throwIfAborted();
      _setRuntimeAvailability(runtimeState, runtimeState.process ? EngineAvailability.Ready : EngineAvailability.Unavailable);
    });
  },
  /** Starts one engine-backed player turn, begins available pondering from its guarded result, then submits the move through the shared player flow. */
  async startPlayerTurn(engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>, signal?: AbortSignal) {
    if (signal?.aborted) return;
    const searchedPosition = game.$?.livePosition;
    if (!searchedPosition) throw new Error(`Live position is unavailable for game ${game.metadata.id}.`);
    const engineClient = _getEngineClient(engine);
    let move: IMove | undefined;
    try {
      await _runInitialisedEngineOperation(engine, EngineAvailability.Running, () => engineClient.startPlayerTurn(engine, game));
      if (signal?.aborted) return;
      move = await EngineRuntimeService.awaitPlayerTurnMove(engine, searchedPosition);
    } catch (error) {
      if (signal?.aborted) return;
      throw error;
    }
    if (!move || signal?.aborted) return;
    const ponderMove = move.$?.ponderMove;
    const pondering = ponderMove && game.resultState === ResultState.Ongoing && _canPonder(searchedPosition, move, ponderMove)
      ? EngineRuntimeService.startPondering(engine, game, move, ponderMove).catch(() => undefined)
      : undefined;
    if (signal?.aborted) return;
    await attemptPlayerMove(move);
    await pondering;
  },
  /** Mutates engine.$ by starting a client-private ponder search while runtime availability remains ready. */
  async startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMoveRaw, ponderMove: IMoveRaw) {
    const engineClient = _getEngineClient(engine);
    await _runInitialisedEngineOperation(engine, EngineAvailability.Ready, () => engineClient.startPondering(engine, game, engineMove, ponderMove));
  },
  /** Mutates engine.$ by registering one shared analysis callback. */
  subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void {
    const runtimeState = _createBaseRuntime(engine);
    runtimeState.analysisCallback = onUpdate;
    return () => {
      if (runtimeState.analysisCallback === onUpdate) runtimeState.analysisCallback = undefined;
    };
  },
  /** May mutate engine.$ by updating runtime availability when the process handle is stale or the wait fails. */
  async awaitPlayerTurnMove(engine: IAssignedEngine, searchedPosition: IBoardPosition): Promise<IMove> {
    const engineClient = _getEngineClient(engine);
    return _runLiveEngineOperation(engine, EngineAvailability.Ready, async () => {
      const move = await engineClient.awaitPlayerTurnMove(engine);
      if (!isMoveLegal(searchedPosition, move)) throw new Error(`Engine returned an illegal move from ${move.from} to ${move.to}.`);
      const ponderMove = move.$?.ponderMove;
      if (!ponderMove) return move;
      const nextPosition = MoveApplicationService.genPosition(searchedPosition, [move]);
      if (!isMoveLegal(nextPosition, ponderMove)) throw new Error(`Engine returned an illegal ponder move from ${ponderMove.from} to ${ponderMove.to}.`);
      return move;
    });
  },
  /** Does not mutate engine. */
  isRuntimeAlive(engine: IAssignedEngine): boolean {
    const runtimeState = _getRuntimeState(engine);
    if (!runtimeState || !runtimeState.process || runtimeState.availability === EngineAvailability.Unavailable || runtimeState.availability === EngineAvailability.Failed) return false;
    try {
      usePlatformService().getProcessManager(engine.clientType).assertProcessOpen(runtimeState.process);
      return true;
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
      return false;
    }
  },
  /** Mutates engine.$ by replacing process and runtime status. */
  async restartEngine(engine: IAssignedEngine) {
    return _queueEngineDisposal(engine, _createBaseRuntime(engine), true);
  },
  /** Mutates engine.$ by clearing process, analysis state, and setting availability unavailable. */
  async stopEngine(engine: IAssignedEngine) {
    const runtimeState = _getRuntimeState(engine);
    return runtimeState ? _queueEngineDisposal(engine, runtimeState, false) : Promise.resolve();
  },
};
