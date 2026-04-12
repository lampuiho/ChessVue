import { EngineAvailability, type IAssignedEngine, type IEngineAnalysisRequest, type IEnginePositionState, type IEngineRegistrationRequest, type IMove } from '@/contracts';
import { EngineClientType, usePlatformService } from '@/platform';
import type { IEngineAnalysisUpdate } from '@/platform';

interface IAssignedEngineRuntimeState {
  processHandle: string | null;
  availability: EngineAvailability;
  lastError: string | null;
}
type IRuntimeAssignedEngine = IAssignedEngine & { $?: IAssignedEngineRuntimeState };
const _analysisCallbacksByEngineId = new Map<string, Set<(update: IEngineAnalysisUpdate) => void>>();

function getRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntimeState | null {
  return (engine as IRuntimeAssignedEngine).$ ?? null;
}
function getOrCreateRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntimeState {
  const runtimeEngine = engine as IRuntimeAssignedEngine;
  runtimeEngine.$ ??= { processHandle: null, availability: EngineAvailability.Unavailable, lastError: null };
  return runtimeEngine.$;
}
function setRuntimeAvailability(engine: IAssignedEngine, availability: EngineAvailability, lastError: string | null = null): void {
  const runtimeState = getOrCreateRuntimeState(engine);
  runtimeState.processHandle = runtimeState.processHandle ?? null;
  runtimeState.availability = availability;
  runtimeState.lastError = lastError;
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
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    setRuntimeAvailability(engine, EngineAvailability.Starting, null);
    await runEngineOperation(engine, async () => {
      await engineClient.initialiseEngine(engine);
      const runtimeState = getOrCreateRuntimeState(engine);
      runtimeState.processHandle = runtimeState.processHandle ?? null;
    });
  },
  async registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.registerEngine(engine, request));
  },
  async syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.syncPosition(engine, positionState));
  },
  async startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    _analysisCallbacksByEngineId.set(engine.assignedEngineId, _analysisCallbacksByEngineId.get(engine.assignedEngineId) ?? new Set());
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.startAnalysis(engine, request, (update) => {
      for (const callback of _analysisCallbacksByEngineId.get(engine.assignedEngineId) ?? []) callback(update);
    }));
  },
  async stopAnalysis(engine: IAssignedEngine): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    await runEngineOperation(engine, () => engineClient.stopAnalysis(engine));
  },
  async startPlayerTurn(engine: IAssignedEngine): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    await this.ensureReady(engine);
    await runEngineOperation(engine, () => engineClient.startPlayerTurn(engine));
  },
  subscribeToAnalysis(engine: IAssignedEngine, onUpdate: (update: IEngineAnalysisUpdate) => void): () => void {
    const callbacks = _analysisCallbacksByEngineId.get(engine.assignedEngineId) ?? new Set<(update: IEngineAnalysisUpdate) => void>();
    callbacks.add(onUpdate);
    _analysisCallbacksByEngineId.set(engine.assignedEngineId, callbacks);
    return () => {
      callbacks.delete(onUpdate);
      if (callbacks.size === 0) _analysisCallbacksByEngineId.delete(engine.assignedEngineId);
    };
  },
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    return runEngineOperation(engine, () => engineClient.awaitPlayerTurnMove(engine));
  },
  getRuntime(engine: IAssignedEngine): IAssignedEngineRuntimeState | null {
    const runtimeState = getRuntimeState(engine);
    return runtimeState === null ? null : { ...runtimeState };
  },
  async restartEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    setRuntimeAvailability(engine, EngineAvailability.Starting, null);
    await runEngineOperation(engine, () => engineClient.restartEngine(engine));
  },
  async stopEngine(engine: IAssignedEngine): Promise<void> {
    const engineClient = usePlatformService().getEngineClient(EngineClientType.Uci);
    await runEngineOperation(engine, () => engineClient.stopEngine(engine));
    const runtimeState = getOrCreateRuntimeState(engine);
    runtimeState.processHandle = null;
    _analysisCallbacksByEngineId.delete(engine.assignedEngineId);
    setRuntimeAvailability(engine, EngineAvailability.Unavailable, null);
  },
};
