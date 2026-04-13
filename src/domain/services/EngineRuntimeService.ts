import { EngineAvailability, type IAssignedEngine, type IEngineAnalysisRequest, type IEnginePositionState, type IEngineRegistrationRequest, type IMove } from '@/contracts';
import { usePlatformService } from '@/platform';
import type { IEngineAnalysisUpdate } from '@/platform';

interface IAssignedEngineRuntime {
  processHandle: string | null;
  availability: EngineAvailability;
  lastError: string | null;
  analysisCallbacks: Set<(update: IEngineAnalysisUpdate) => void>;
}
type IRuntimeAssignedEngine = IAssignedEngine & { $?: IAssignedEngineRuntime };

function getRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime | null {
  return (engine as IRuntimeAssignedEngine).$ ?? null;
}
function getOrCreateRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime {
  const runtimeEngine = engine as IRuntimeAssignedEngine;
  runtimeEngine.$ ??= { processHandle: null, availability: EngineAvailability.Unavailable, lastError: null, analysisCallbacks: new Set() };
  return runtimeEngine.$;
}
function setRuntimeAvailability(engine: IAssignedEngine, availability: EngineAvailability, lastError: string | null = null): void {
  const runtimeState = getOrCreateRuntimeState(engine);
  runtimeState.processHandle = runtimeState.processHandle ?? null;
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
}
function getEngineClient(engine: IAssignedEngine) {
  return usePlatformService().getEngineClient(engine.clientType);
}
async function runEngineOperation<T>(engine: IAssignedEngine, operation: () => Promise<T>): Promise<T> {
  try {
    const result = await operation();
    const runtimeState = getRuntimeState(engine);
    setRuntimeAvailability(engine, runtimeState?.processHandle === null ? EngineAvailability.Ready : EngineAvailability.Running, null);
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
    await runEngineOperation(engine, async () => {
      await engineClient.initialiseEngine(engine);
      const runtimeState = getOrCreateRuntimeState(engine);
      runtimeState.processHandle = runtimeState.processHandle ?? null;
    });
  },
  async registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.registerEngine(engine, request));
  },
  async syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.syncPosition(engine, positionState));
  },
  async startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void> {
    const engineClient = getEngineClient(engine);
    const runtimeState = getOrCreateRuntimeState(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.startAnalysis(engine, request, (update) => {
      for (const callback of runtimeState.analysisCallbacks) callback(update);
    }));
  },
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runEngineOperation(engine, () => engineClient.stopAnalysis(engine));
  },
  async startPlayerTurn(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.startPlayerTurn(engine));
  },
  subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void {
    const runtimeState = getOrCreateRuntimeState(engine);
    runtimeState.analysisCallbacks.add(onUpdate);
    return () => {
      runtimeState.analysisCallbacks.delete(onUpdate);
    };
  },
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const engineClient = getEngineClient(engine);
    return runEngineOperation(engine, () => engineClient.awaitPlayerTurnMove(engine));
  },
  isRuntimeAlive(engine: IAssignedEngine): boolean {
    const runtimeState = getRuntimeState(engine);
    return runtimeState !== null
      && runtimeState.availability !== EngineAvailability.Unavailable
      && runtimeState.availability !== EngineAvailability.Failed;
  },
  async restartEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    setRuntimeAvailability(engine, EngineAvailability.Starting, null);
    await runEngineOperation(engine, () => engineClient.restartEngine(engine));
  },
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = getEngineClient(engine);
    await runEngineOperation(engine, () => engineClient.stopEngine(engine));
    const runtimeState = getOrCreateRuntimeState(engine);
    runtimeState.processHandle = null;
    runtimeState.analysisCallbacks.clear();
    setRuntimeAvailability(engine, EngineAvailability.Unavailable, null);
  },
};
