import { EngineAvailability, PlatformError, PlatformErrorKind, type IAssignedEngine, type IAssignedEngineRuntime, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEnginePositionState, type IMove, type IPlatformError } from '@/contracts';
import { usePlatformService } from '@/platform';
import { isPlatformError } from '@/utility/errors/StandardErrorHandlingUtility';

type IRuntimeAssignedEngine = IAssignedEngine & { $: IAssignedEngineRuntime };

function _hasRuntimeState(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return engine.$ !== undefined;
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
  runtimeState.analysisCallback = undefined;
  runtimeState.analysisLines.clear();
}
function _isInvalidProcessHandleError(error: unknown): boolean {
  return isPlatformError(error) && error.kind === PlatformErrorKind.InvalidProcessHandle;
}
function _createEngineNotInitialisedError(engine: IAssignedEngine): IPlatformError {
  return new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'engineRuntime', message: `Engine process is not initialised for ${engine.displayName}.` });
}
async function _initialiseEngine(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): Promise<void> {
  const processManager = usePlatformService().getProcessManager();
  _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  try {
    if (!runtimeState.processHandle) runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
    else processManager.assertProcessHandleOpen(runtimeState.processHandle);
  } catch (error) {
    if (!_isInvalidProcessHandleError(error)) throw error;
    runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
  }
  await _getEngineClient(engine).initialiseEngine(engine);
}
function _assertProcessHandleOpen(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): void {
  const processHandle = runtimeState.processHandle;
  if (!processHandle) throw _createEngineNotInitialisedError(engine);
  usePlatformService().getProcessManager().assertProcessHandleOpen(processHandle);
}
function _getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function _runEngineOperation<T>(runtimeState: IAssignedEngineRuntime, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    _setRuntimeAvailability(runtimeState, successAvailability);
    return result;
  } catch (error) {
    if (_isInvalidProcessHandleError(error)) runtimeState.processHandle = undefined;
    _setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error ? error.message : 'Unknown engine runtime failure.');
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

export const EngineRuntimeService = {
  /** Mutates engine.$ by creating or refreshing runtime state, including processHandle, availability, and lastError. */
  async ensureReady(engine: IAssignedEngine): Promise<void> {
    const runtimeState = _createBaseRuntime(engine);
    await _runEngineOperation(runtimeState, EngineAvailability.Ready, async () => {
      await _initialiseEngine(engine, runtimeState);
    });
  },
  /** Mutates engine.$ the same way as ensureReady, then updates nested platform session state for the synced position. */
  async syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
    const engineClient = _getEngineClient(engine);
    await _runInitialisedEngineOperation(engine, EngineAvailability.Ready, () => engineClient.syncPosition(engine, positionState));
  },
  /** Mutates engine.$ the same way as ensureReady, then updates shared analysis runtime state used for streamed callbacks. */
  async startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void> {
    const runtimeState = _assertBaseRuntime(engine);
    const engineClient = _getEngineClient(engine);
    await _runInitialisedEngineOperation(engine, EngineAvailability.Running, () => engineClient.startAnalysis(engine, request, runtimeState.analysisCallback ?? (() => {})));
  },
  /** May mutate engine.$ by updating runtime availability when the process handle is stale or the stop fails. */
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const engineClient = _getEngineClient(engine);
    await _runLiveEngineOperation(engine, EngineAvailability.Ready, () => engineClient.stopAnalysis(engine));
  },
  /** Mutates engine.$ the same way as ensureReady, then updates nested platform session player-turn state. */
  async startPlayerTurn(engine: IAssignedEngine): Promise<void> {
    const engineClient = _getEngineClient(engine);
    await _runInitialisedEngineOperation(engine, EngineAvailability.Running, () => engineClient.startPlayerTurn(engine));
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
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const engineClient = _getEngineClient(engine);
    return _runLiveEngineOperation(engine, EngineAvailability.Ready, () => engineClient.awaitPlayerTurnMove(engine));
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
    const engineClient = _getEngineClient(engine);
    const processManager = usePlatformService().getProcessManager();
    const runtimeState = _createBaseRuntime(engine);
    _setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
    if (runtimeState.processHandle) {
      try {
        await engineClient.stopEngine(engine);
      } catch (error) {
        if (!_isInvalidProcessHandleError(error)) throw error;
      }
    }
    if (!runtimeState.processHandle) runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
    else {
      try {
        runtimeState.processHandle = await processManager.restartProcess(runtimeState.processHandle, engine.executablePath);
      } catch (error) {
        if (!_isInvalidProcessHandleError(error)) throw error;
        runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
      }
    }
    await _runEngineOperation(runtimeState, EngineAvailability.Ready, () => engineClient.initialiseEngine(engine));
  },
  /** Mutates engine.$ by clearing processHandle, analysis state, and setting availability unavailable. */
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = _getEngineClient(engine);
    const runtimeState = _getRuntimeState(engine);
    if (!runtimeState) return;
    const processHandle = runtimeState.processHandle;
    if (!processHandle) {
      _clearAnalysisState(runtimeState);
      _setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
      return;
    }
    try {
      await engineClient.stopEngine(engine);
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
    }
    try {
      await usePlatformService().getProcessManager().stopProcess(processHandle);
    } catch (error) {
      if (!_isInvalidProcessHandleError(error)) throw error;
    }
    runtimeState.processHandle = undefined;
    _clearAnalysisState(runtimeState);
    _setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
  },
};
