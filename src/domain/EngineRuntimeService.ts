import { EngineAvailability, PlatformError, PlatformErrorKind, ResultState, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisOperation, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEngineOptionMeta, type IEngineRecord, type IGame, type IMove, type IPlatformError } from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { Deferred } from '@/utility/async/Deferred';
import { usePlatformService } from '@/platform';
import { isMoveLegal } from '@/utility/chess';
import { isPlatformError } from '@/utility/errors/StandardErrorHandlingUtility';
import { MoveApplicationService } from './MoveApplicationService';

type IRuntimeAssignedEngine = IAssignedEngine & { $: IAssignedEngineRuntime };

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
    executablePath: engineProfile.executablePath,
    clientType: engineProfile.clientType,
    protocol: engineProfile.protocol,
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
function _setRuntimeAvailability(runtimeState: IAssignedEngineRuntime, availability: EngineAvailability, lastError?: string): void {
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
}
function _clearAnalysisState(runtimeState: IAssignedEngineRuntime): void {
  runtimeState.analysisLines.clear();
  runtimeState.analysisNeedsStop = false;
}
function _isMoveSequenceLegal(position: IBoardPosition, moves: readonly IMove[]): boolean {
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
  return update.lines.every((line) => _isMoveSequenceLegal(position, line.pv as readonly IMove[]));
}
function _acceptAnalysisUpdate(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation, update: IEngineAnalysisUpdate): boolean {
  if (!_isCurrentAnalysis(runtimeState, operation) || operation.isFinal) return false;
  if (!_isAnalysisUpdateLegal(update)) return false;
  operation.isFinal = update.isFinal;
  if (update.isFinal) runtimeState.analysisNeedsStop = false;
  _setRuntimeAvailability(runtimeState, update.isFinal ? EngineAvailability.Ready : EngineAvailability.Running);
  return true;
}
function _isCurrentAnalysis(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation): boolean {
  return runtimeState.analysisOperation === operation && !operation.abortController.signal.aborted;
}
function _beginAnalysisOperation(runtimeState: IAssignedEngineRuntime): IEngineAnalysisOperation {
  const previous = runtimeState.analysisOperation;
  if (previous) {
    const error = new Aborted('Analysis was superseded.');
    previous.abortController.abort(error);
    previous.completion.reject(error);
  }
  const operation = { abortController: new AbortController(), completion: new Deferred<void>(), isFinal: false };
  runtimeState.analysisOperation = operation;
  return operation;
}
function _queueAnalysisOperation(runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation, action: () => Promise<void>): Promise<void> {
  const previousWork = runtimeState.analysisWork ?? Promise.resolve();
  const work = previousWork.then(async () => {
    if (!_isCurrentAnalysis(runtimeState, operation)) return;
    try {
      await action();
      if (_isCurrentAnalysis(runtimeState, operation)) operation.completion.resolve();
    } catch (error) {
      if (!_isCurrentAnalysis(runtimeState, operation)) return;
      if (_isInvalidProcessHandleError(error)) runtimeState.processHandle = undefined;
      if (!(error instanceof Aborted)) _setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error ? error.message : 'Unknown engine runtime failure.');
      operation.abortController.abort(error);
      operation.completion.reject(error);
    }
  }).finally(() => {
    if (runtimeState.analysisWork === work) runtimeState.analysisWork = undefined;
  });
  runtimeState.analysisWork = work;
  return operation.completion;
}
function _isInvalidProcessHandleError(error: unknown): boolean {
  return isPlatformError(error) && error.kind === PlatformErrorKind.InvalidProcessHandle;
}
function _createEngineNotInitialisedError(engine: IAssignedEngine): IPlatformError {
  return new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'engineRuntime', message: `Engine process is not initialised for ${engine.displayName}.` });
}
async function _initialiseEngine(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, signal?: AbortSignal): Promise<void> {
  const processManager = usePlatformService().getProcessManager();
  _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  try {
    if (!runtimeState.processHandle) runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
    else processManager.assertProcessHandleOpen(runtimeState.processHandle);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
    runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
  }
  if (!signal?.aborted) await _getEngineClient(engine).initialiseEngine(engine);
}
function _assertProcessHandleOpen(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): void {
  const processHandle = runtimeState.processHandle;
  if (!processHandle) throw _createEngineNotInitialisedError(engine);
  usePlatformService().getProcessManager().assertProcessHandleOpen(processHandle);
}
function _getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function _runEngineOperation<T>(runtimeState: IAssignedEngineRuntime, successAvailability: EngineAvailability, operation: () => Promise<T>, isCurrent: () => boolean = () => true): Promise<T> {
  try {
    const result = await operation();
    if (isCurrent()) _setRuntimeAvailability(runtimeState, successAvailability);
    return result;
  } catch (error) {
    if (isCurrent()) {
      if (_isInvalidProcessHandleError(error)) runtimeState.processHandle = undefined;
      _setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error ? error.message : 'Unknown engine runtime failure.');
    }
    throw error;
  }
}
async function _runInitialisedEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  const runtimeState = _assertBaseRuntime(engine);
  return _runEngineOperation(runtimeState, successAvailability, async () => {
    try {
      _assertProcessHandleOpen(engine, runtimeState);
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
    _assertProcessHandleOpen(engine, runtimeState);
    return operation();
  });
}
async function _stopClientSession(engine: IAssignedEngine): Promise<void> {
  try {
    await _getEngineClient(engine).stopEngine(engine);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
  }
}
async function _stopEngineProcess(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation): Promise<void> {
  const processHandle = runtimeState.processHandle;
  if (processHandle) {
    await _stopClientSession(engine);
    try {
      await usePlatformService().getProcessManager().stopProcess(processHandle);
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
    }
  }
  runtimeState.processHandle = undefined;
  _clearAnalysisState(runtimeState);
  if (_isCurrentAnalysis(runtimeState, operation)) _setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
}
async function _restartEngineProcess(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, operation: IEngineAnalysisOperation): Promise<void> {
  const processManager = usePlatformService().getProcessManager();
  if (runtimeState.processHandle) await _stopClientSession(engine);
  runtimeState.analysisNeedsStop = false;
  try {
    runtimeState.processHandle = runtimeState.processHandle
      ? await processManager.restartProcess(runtimeState.processHandle, engine.executablePath)
      : await processManager.spawnProcess(engine.executablePath);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
    runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
  }
  if (!_isCurrentAnalysis(runtimeState, operation)) return;
  await _runEngineOperation(runtimeState, EngineAvailability.Ready, () => _getEngineClient(engine).initialiseEngine(engine), () => _isCurrentAnalysis(runtimeState, operation));
}
function _queueEngineDisposal(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime, restart: boolean): Promise<void> {
  const operation = _beginAnalysisOperation(runtimeState);
  const onUpdate = runtimeState.analysisCallback;
  // Terminal cleanup releases a client wait immediately; a pending spawn is drained by the work handle.
  const interruption = runtimeState.analysisWork && runtimeState.processHandle ? _stopClientSession(engine) : Promise.resolve();
  const interrupted = interruption.then(() => undefined, (error: unknown) => ({ error }));
  if (restart) _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  return _queueAnalysisOperation(runtimeState, operation, async () => {
    const failure = await interrupted;
    if (failure) throw failure.error;
    if (restart) await _restartEngineProcess(engine, runtimeState, operation);
    else {
      await _stopEngineProcess(engine, runtimeState, operation);
      if (_isCurrentAnalysis(runtimeState, operation) && runtimeState.analysisCallback === onUpdate) runtimeState.analysisCallback = undefined;
    }
  });
}

export const EngineRuntimeService = {
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
  /** Mutates engine.$ by creating or refreshing runtime state, including processHandle, availability, and lastError. */
  async ensureReady(engine: IAssignedEngine, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    const runtimeState = _createBaseRuntime(engine);
    try {
      await _runEngineOperation(runtimeState, EngineAvailability.Ready, async () => {
        await _initialiseEngine(engine, runtimeState, signal);
      }, () => !signal?.aborted);
    } catch (error) {
      if (!signal?.aborted) throw error;
    }
  },
  /** Supersedes pending analysis and owns readiness, startup, and the guarded streaming callback. */
  async startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest): Promise<void> {
    const runtimeState = _assertBaseRuntime(engine);
    const operation = _beginAnalysisOperation(runtimeState);
    const onUpdate = runtimeState.analysisCallback;
    _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
    return _queueAnalysisOperation(runtimeState, operation, async () => {
      await EngineRuntimeService.ensureReady(engine, operation.abortController.signal);
      if (!_isCurrentAnalysis(runtimeState, operation)) return;
      _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
      runtimeState.analysisNeedsStop = true;
      await _getEngineClient(engine).startAnalysis(engine, game, request, (update) => {
        if (runtimeState.analysisCallback !== onUpdate || !_acceptAnalysisUpdate(runtimeState, operation, update)) return false;
        onUpdate?.(update);
        return true;
      });
      if (_isCurrentAnalysis(runtimeState, operation) && !operation.isFinal) _setRuntimeAvailability(runtimeState, EngineAvailability.Running);
    });
  },
  /** May mutate engine.$ by updating runtime availability when the process handle is stale or the stop fails. */
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const runtimeState = _getRuntimeState(engine);
    if (!runtimeState) return Promise.resolve();
    const operation = _beginAnalysisOperation(runtimeState);
    return _queueAnalysisOperation(runtimeState, operation, async () => {
      if (runtimeState.analysisNeedsStop && runtimeState.processHandle) {
        _assertProcessHandleOpen(engine, runtimeState);
        await _getEngineClient(engine).stopAnalysis(engine);
      }
      runtimeState.analysisNeedsStop = false;
      if (_isCurrentAnalysis(runtimeState, operation)) _setRuntimeAvailability(runtimeState, runtimeState.processHandle ? EngineAvailability.Ready : EngineAvailability.Unavailable);
    });
  },
  /** Starts one engine-backed player turn, begins available pondering from its guarded result, then submits the move through the shared player flow. */
  async startPlayerTurn(engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>, signal?: AbortSignal): Promise<void> {
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
    const pondering = ponderMove && game.resultState === ResultState.Ongoing
      ? EngineRuntimeService.startPondering(engine, game, move, ponderMove).catch(() => undefined)
      : undefined;
    if (signal?.aborted) return;
    await attemptPlayerMove(move);
    await pondering;
  },
  /** Mutates engine.$ by starting a client-private ponder search while runtime availability remains ready. */
  async startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMove, ponderMove: IMove): Promise<void> {
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
    if (!runtimeState || !runtimeState.processHandle || runtimeState.availability === EngineAvailability.Unavailable || runtimeState.availability === EngineAvailability.Failed) return false;
    try {
      usePlatformService().getProcessManager().assertProcessHandleOpen(runtimeState.processHandle);
      return true;
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
      return false;
    }
  },
  /** Mutates engine.$ by replacing processHandle and runtime status. */
  async restartEngine(engine: IAssignedEngine): Promise<void> {
    return _queueEngineDisposal(engine, _createBaseRuntime(engine), true);
  },
  /** Mutates engine.$ by clearing processHandle, analysis state, and setting availability unavailable. */
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const runtimeState = _getRuntimeState(engine);
    return runtimeState ? _queueEngineDisposal(engine, runtimeState, false) : Promise.resolve();
  },
};
