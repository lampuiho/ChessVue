import { EngineAvailability, PlatformErrorKind, type IAssignedEngine, type IAssignedEngineRuntime, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEnginePositionState, type IEngineRegistrationRequest, type IMove, type IPlatformError } from '@/contracts';
import { usePlatformService } from '@/platform';

interface IEngineRuntimeState {
  analysisSubscribers: Array<(update: IEngineAnalysisUpdate) => void>;
  unexpectedExitUnsubscribe?: () => void;
}
type IRuntimeAssignedEngine = IAssignedEngine & { $: IAssignedEngineRuntime };
const _engineRuntimeStateKey = Symbol('engineRuntimeState');
type IInternalAssignedEngine = IAssignedEngine & { [_engineRuntimeStateKey]?: IEngineRuntimeState };

function hasRuntimeState(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return engine.$ !== undefined;
}
function getRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime | undefined {
  return engine.$;
}
function getEngineRuntimeState(engine: IAssignedEngine): IEngineRuntimeState {
  const internalEngine = engine as IInternalAssignedEngine;
  const existingState = internalEngine[_engineRuntimeStateKey];
  if (existingState !== undefined) return existingState;
  const nextState: IEngineRuntimeState = { analysisSubscribers: [] };
  internalEngine[_engineRuntimeStateKey] = nextState;
  return nextState;
}
function createBaseRuntime(engine: IAssignedEngine): IAssignedEngineRuntime {
  if (hasRuntimeState(engine)) return engine.$;
  const runtimeEngine = engine as IRuntimeAssignedEngine;
  runtimeEngine.$ = { availability: EngineAvailability.Unavailable };
  if (hasRuntimeState(runtimeEngine)) return runtimeEngine.$;
  throw new Error(`Failed to initialise runtime state for ${engine.displayName}.`);
}
function assertBaseRuntime(engine: IAssignedEngine): IAssignedEngineRuntime {
  const runtimeState = getRuntimeState(engine);
  if (runtimeState) return runtimeState;
  throw new Error(`Engine runtime state is not available for ${engine.displayName}.`);
}
function setRuntimeAvailability(runtimeState: IAssignedEngineRuntime, availability: EngineAvailability, lastError?: string): void {
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
}
function clearUnexpectedExitSubscription(engine: IAssignedEngine): void {
  const engineState = getEngineRuntimeState(engine);
  engineState.unexpectedExitUnsubscribe?.();
  engineState.unexpectedExitUnsubscribe = undefined;
}
function bindUnexpectedExit(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): void {
  const processHandle = runtimeState.processHandle;
  const engineState = getEngineRuntimeState(engine);
  if (!processHandle) throw new Error(`Engine process is not available for ${engine.displayName}.`);
  clearUnexpectedExitSubscription(engine);
  engineState.unexpectedExitUnsubscribe = usePlatformService().getProcessManager().subscribeToUnexpectedExit(processHandle, (error) => {
    runtimeState.processHandle = undefined;
    clearUnexpectedExitSubscription(engine);
    runtimeState.availability = EngineAvailability.Failed;
    runtimeState.lastError = error.message;
  });
}
function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && typeof (error as { kind?: unknown }).kind === 'string';
}
function isInvalidProcessHandleError(error: unknown): boolean {
  return isPlatformError(error) && error.kind === PlatformErrorKind.InvalidProcessHandle;
}
async function ensureProcessHandleOpenOrRestartOnce(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): Promise<void> {
  const processManager = usePlatformService().getProcessManager();
  const currentHandle = runtimeState.processHandle;
  if (!currentHandle) {
    runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
    bindUnexpectedExit(engine, runtimeState);
    return;
  }
  try {
    bindUnexpectedExit(engine, runtimeState);
    return;
  } catch (error) {
    if (!isInvalidProcessHandleError(error)) throw error;
  }
  clearUnexpectedExitSubscription(engine);
  try {
    runtimeState.processHandle = await processManager.restartProcess(currentHandle, engine.executablePath);
  } catch (error) {
    if (!isInvalidProcessHandleError(error)) throw error;
    runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
  }
  bindUnexpectedExit(engine, runtimeState);
}
function getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function runEngineOperation<T>(runtimeState: IAssignedEngineRuntime, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    setRuntimeAvailability(runtimeState, successAvailability);
    return result;
  } catch (error) {
    setRuntimeAvailability(runtimeState, EngineAvailability.Failed, error instanceof Error ? error.message : 'Unknown engine runtime failure.');
    throw error;
  }
}
async function initialiseEngineOnce(engine: IAssignedEngine, runtimeState: IAssignedEngineRuntime): Promise<void> {
  setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
  await ensureProcessHandleOpenOrRestartOnce(engine, runtimeState);
  await getEngineClient(engine).initialiseEngine(engine);
}
async function runReadyEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  const runtimeState = assertBaseRuntime(engine);
  const engineClient = getEngineClient(engine);
  try {
    await initialiseEngineOnce(engine, runtimeState);
    return await runEngineOperation(runtimeState, successAvailability, operation);
  } catch (error) {
    if (!isInvalidProcessHandleError(error)) throw error;
    await ensureProcessHandleOpenOrRestartOnce(engine, runtimeState);
    await engineClient.initialiseEngine(engine);
    return runEngineOperation(runtimeState, successAvailability, operation);
  }
}
async function runRetryableEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, shouldInitialiseAfterRestart: boolean, operation: () => Promise<T>): Promise<T> {
  const runtimeState = assertBaseRuntime(engine);
  const engineClient = getEngineClient(engine);
  try {
    return await runEngineOperation(runtimeState, successAvailability, operation);
  } catch (error) {
    if (!isInvalidProcessHandleError(error)) throw error;
    await ensureProcessHandleOpenOrRestartOnce(engine, runtimeState);
    if (shouldInitialiseAfterRestart) await engineClient.initialiseEngine(engine);
    return runEngineOperation(runtimeState, successAvailability, operation);
  }
}

export const EngineRuntimeService = {
  async ensureReady(engine: IAssignedEngine): Promise<void> {
    const runtimeState = createBaseRuntime(engine);
    await runEngineOperation(runtimeState, EngineAvailability.Ready, async () => {
      await initialiseEngineOnce(engine, runtimeState);
    });
  },
  async registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runReadyEngineOperation(engine, EngineAvailability.Ready, () => engineClient.registerEngine(engine, request));
  },
  async syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runReadyEngineOperation(engine, EngineAvailability.Ready, () => engineClient.syncPosition(engine, positionState));
  },
  async startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void> {
    const engineState = getEngineRuntimeState(engine);
    const engineClient = getEngineClient(engine);
    await runReadyEngineOperation(engine, EngineAvailability.Running, () => engineClient.startAnalysis(engine, request, (update) => {
      for (const callback of engineState.analysisSubscribers) callback(update);
    }));
  },
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runRetryableEngineOperation(engine, EngineAvailability.Ready, true, () => engineClient.stopAnalysis(engine));
  },
  async startPlayerTurn(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runReadyEngineOperation(engine, EngineAvailability.Running, () => engineClient.startPlayerTurn(engine));
  },
  subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void {
    const engineState = getEngineRuntimeState(engine);
    if (!engineState.analysisSubscribers.includes(onUpdate)) engineState.analysisSubscribers.push(onUpdate);
    return () => {
      const callbackIndex = engineState.analysisSubscribers.indexOf(onUpdate);
      if (callbackIndex >= 0) engineState.analysisSubscribers.splice(callbackIndex, 1);
    };
  },
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const engineClient = getEngineClient(engine);
    return runRetryableEngineOperation(engine, EngineAvailability.Ready, true, () => engineClient.awaitPlayerTurnMove(engine));
  },
  isRuntimeAlive(engine: IAssignedEngine): boolean {
    const runtimeState = getRuntimeState(engine);
    return !!runtimeState
      && !!runtimeState.processHandle
      && runtimeState.availability !== EngineAvailability.Unavailable
      && runtimeState.availability !== EngineAvailability.Failed;
  },
  async restartEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    const processManager = usePlatformService().getProcessManager();
    const runtimeState = createBaseRuntime(engine);
    setRuntimeAvailability(runtimeState, EngineAvailability.Starting);
    if (runtimeState.processHandle) {
      try {
        await engineClient.stopEngine(engine);
      } catch (error) {
        if (!isInvalidProcessHandleError(error)) throw error;
      }
    }
    clearUnexpectedExitSubscription(engine);
    if (!runtimeState.processHandle) runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
    else {
      try {
        runtimeState.processHandle = await processManager.restartProcess(runtimeState.processHandle, engine.executablePath);
      } catch (error) {
        if (!isInvalidProcessHandleError(error)) throw error;
        runtimeState.processHandle = await processManager.spawnProcess(engine.executablePath);
      }
    }
    bindUnexpectedExit(engine, runtimeState);
    await runEngineOperation(runtimeState, EngineAvailability.Ready, () => engineClient.initialiseEngine(engine));
  },
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    const runtimeState = getRuntimeState(engine);
    const engineState = getEngineRuntimeState(engine);
    if (!runtimeState) {
      clearUnexpectedExitSubscription(engine);
      engineState.analysisSubscribers.length = 0;
      return;
    }
    const processHandle = runtimeState.processHandle;
    if (!processHandle) {
      clearUnexpectedExitSubscription(engine);
      engineState.analysisSubscribers.length = 0;
      setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
      return;
    }
    await engineClient.stopEngine(engine);
    clearUnexpectedExitSubscription(engine);
    try {
      await usePlatformService().getProcessManager().stopProcess(processHandle);
    } catch (error) {
      if (!isInvalidProcessHandleError(error)) throw error;
    }
    runtimeState.processHandle = undefined;
    engineState.analysisSubscribers.length = 0;
    setRuntimeAvailability(runtimeState, EngineAvailability.Unavailable);
  },
};
