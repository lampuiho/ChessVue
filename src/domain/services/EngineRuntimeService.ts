import { EngineAvailability, type IAssignedEngine, type IAssignedEngineRuntime, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEnginePositionState, type IEngineRegistrationRequest, type IMove } from '@/contracts';
import { usePlatformService } from '@/platform';

interface IInternalAssignedEngineRuntime extends IAssignedEngineRuntime {
  analysisCallbacks: Set<(update: IEngineAnalysisUpdate) => void>;
  unexpectedExitUnsubscribe: (() => void) | null;
}
type IRuntimeAssignedEngine = IAssignedEngine & { $: IInternalAssignedEngineRuntime };

function hasRuntimeState(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return engine.$ !== undefined && 'analysisCallbacks' in engine.$ && 'unexpectedExitUnsubscribe' in engine.$;
}
function getRuntimeState(engine: IAssignedEngine): IInternalAssignedEngineRuntime | null {
  return hasRuntimeState(engine) ? engine.$ : null;
}
function _initialiseAssignedEngine(engine: IAssignedEngine): IRuntimeAssignedEngine {
  if (hasRuntimeState(engine)) return engine;
  const baseRuntime = engine.$ ?? { processHandle: null, availability: EngineAvailability.Unavailable, lastError: null };
  const runtimeEngine = engine as IRuntimeAssignedEngine;
  runtimeEngine.$ = { ...baseRuntime, analysisCallbacks: new Set(), unexpectedExitUnsubscribe: null };
  if (hasRuntimeState(runtimeEngine)) return runtimeEngine;
  throw new Error(`Failed to initialise runtime state for ${engine.displayName}.`);
}
function setRuntimeAvailability(engine: IAssignedEngine, availability: EngineAvailability, lastError: string | null = null): void {
  const runtimeState = _initialiseAssignedEngine(engine).$;
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
}
function clearUnexpectedExitSubscription(runtimeState: IInternalAssignedEngineRuntime): void {
  runtimeState.unexpectedExitUnsubscribe?.();
  runtimeState.unexpectedExitUnsubscribe = null;
}
function bindUnexpectedExit(engine: IAssignedEngine, runtimeState: IInternalAssignedEngineRuntime): void {
  const processHandle = runtimeState.processHandle;
  if (processHandle === null) throw new Error(`Engine process is not available for ${engine.displayName}.`);
  clearUnexpectedExitSubscription(runtimeState);
  runtimeState.unexpectedExitUnsubscribe = usePlatformService().getProcessManager().subscribeToUnexpectedExit(processHandle, (error) => {
    runtimeState.processHandle = null;
    clearUnexpectedExitSubscription(runtimeState);
    runtimeState.availability = EngineAvailability.Failed;
    runtimeState.lastError = error.message;
  });
}
async function ensureProcess(engine: IAssignedEngine): Promise<IInternalAssignedEngineRuntime> {
  const runtimeState = _initialiseAssignedEngine(engine).$;
  if (runtimeState.processHandle !== null) {
    if (runtimeState.unexpectedExitUnsubscribe === null) bindUnexpectedExit(engine, runtimeState);
    return runtimeState;
  }
  runtimeState.processHandle = await usePlatformService().getProcessManager().spawnProcess(engine.executablePath);
  bindUnexpectedExit(engine, runtimeState);
  return runtimeState;
}
function getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function runEngineOperation<T>(engine: IAssignedEngine, successAvailability: EngineAvailability, operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    setRuntimeAvailability(engine, successAvailability, null);
    return result;
  } catch (error) {
    setRuntimeAvailability(engine, EngineAvailability.Failed, error instanceof Error ? error.message : 'Unknown engine runtime failure.');
    throw error;
  }
}

export const EngineRuntimeService = {
  async ensureReady(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    setRuntimeAvailability(engine, EngineAvailability.Starting, null);
    await ensureProcess(engine);
    await runEngineOperation(engine, EngineAvailability.Ready, async () => {
      await engineClient.initialiseEngine(engine);
    });
  },
  async registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, EngineAvailability.Ready, () => engineClient.registerEngine(engine, request));
  },
  async syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, EngineAvailability.Ready, () => engineClient.syncPosition(engine, positionState));
  },
  async startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void> {
    const engineClient = getEngineClient(engine);
    const runtimeState = _initialiseAssignedEngine(engine).$;
    await this.ensureReady(engine);
    await runEngineOperation(engine, EngineAvailability.Running, () => engineClient.startAnalysis(engine, request, (update) => {
      for (const callback of runtimeState.analysisCallbacks) callback(update);
    }));
  },
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runEngineOperation(engine, EngineAvailability.Ready, () => engineClient.stopAnalysis(engine));
  },
  async startPlayerTurn(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, EngineAvailability.Running, () => engineClient.startPlayerTurn(engine));
  },
  subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void {
    const runtimeState = _initialiseAssignedEngine(engine).$;
    runtimeState.analysisCallbacks.add(onUpdate);
    return () => {
      runtimeState.analysisCallbacks.delete(onUpdate);
    };
  },
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const engineClient = getEngineClient(engine);
    return runEngineOperation(engine, EngineAvailability.Ready, () => engineClient.awaitPlayerTurnMove(engine));
  },
  isRuntimeAlive(engine: IAssignedEngine): boolean {
    const runtimeState = getRuntimeState(engine);
    return runtimeState !== null
      && runtimeState.availability !== EngineAvailability.Unavailable
      && runtimeState.availability !== EngineAvailability.Failed;
  },
  async restartEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    const processManager = usePlatformService().getProcessManager();
    const runtimeState = await ensureProcess(engine);
    setRuntimeAvailability(engine, EngineAvailability.Starting, null);
    await engineClient.stopEngine(engine);
    clearUnexpectedExitSubscription(runtimeState);
    runtimeState.processHandle = await processManager.restartProcess(runtimeState.processHandle!, engine.executablePath);
    bindUnexpectedExit(engine, runtimeState);
    await runEngineOperation(engine, EngineAvailability.Ready, () => engineClient.initialiseEngine(engine));
  },
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    const runtimeState = _initialiseAssignedEngine(engine).$;
    const processHandle = runtimeState.processHandle;
    if (processHandle === null) {
      runtimeState.analysisCallbacks.clear();
      setRuntimeAvailability(engine, EngineAvailability.Unavailable, null);
      return;
    }
    await engineClient.stopEngine(engine);
    clearUnexpectedExitSubscription(runtimeState);
    await usePlatformService().getProcessManager().stopProcess(processHandle);
    runtimeState.processHandle = null;
    runtimeState.analysisCallbacks.clear();
    setRuntimeAvailability(engine, EngineAvailability.Unavailable, null);
  },
};
