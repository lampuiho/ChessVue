import { defineStore } from 'pinia';
import { shallowReactive } from 'vue';

import { type EngineClientType, type EngineProtocol, type IEngineOptionMeta, type IEngineRecord } from '@/contracts';
import { EngineRuntimeService, UserSettingService } from '@/domain';

interface IEngineOptionMetaCacheEntry {
  clientType: EngineClientType;
  executablePath: string;
  options: readonly IEngineOptionMeta[];
  protocol: EngineProtocol;
}

function getInventory(): IEngineRecord[] {
  return UserSettingService.getSettings().analysis.engineInventory;
}

export const useEnginesStore = defineStore('enginesStore', () => {
  const _optionMetaByEngineId = shallowReactive(new Map<string, IEngineOptionMetaCacheEntry>());

  function _isCacheEntryCurrent(entry: IEngineOptionMetaCacheEntry, engine: IEngineRecord): boolean {
    return entry.clientType === engine.clientType && entry.executablePath === engine.executablePath && entry.protocol === engine.protocol;
  }
  function _createCacheEntry(engine: IEngineRecord, options: readonly IEngineOptionMeta[]): IEngineOptionMetaCacheEntry {
    return { clientType: engine.clientType, executablePath: engine.executablePath, options, protocol: engine.protocol };
  }
  function _resolveEngine(engine: IEngineRecord | string): IEngineRecord | undefined {
    return typeof engine === 'string' ? getEngine(engine) : engine;
  }
  function listConfiguredEngines(): IEngineRecord[] {
    return getInventory();
  }
  function getEngine(engineId: string): IEngineRecord | undefined {
    return listConfiguredEngines().find((engine) => engine.id === engineId);
  }
  function validateAnalysisSelection(engineIds: string[]) {
    const uniqueIds = new Set(engineIds);
    if (uniqueIds.size !== engineIds.length) throw new Error('Analysis engine selection cannot contain duplicates.');
    if (engineIds.length > 4) throw new Error('Analysis engine selection cannot contain more than four engines.');
    const configuredEngineIds = new Set(listConfiguredEngines().map((engine) => engine.id));
    for (const engineId of engineIds) {
      if (!configuredEngineIds.has(engineId)) throw new Error(`Configured engine not found: ${engineId}.`);
    }
  }
  function getOptionMeta(engineProfile: IEngineRecord | string): readonly IEngineOptionMeta[] | undefined {
    const engine = _resolveEngine(engineProfile);
    const engineId = typeof engineProfile === 'string' ? engineProfile : engineProfile.id;
    const entry = _optionMetaByEngineId.get(engineId);
    if (engine && entry && _isCacheEntryCurrent(entry, engine)) return entry.options;
    if (entry) _optionMetaByEngineId.delete(engineId);
  }
  async function loadOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]> {
    const cachedOptions = getOptionMeta(engineProfile);
    if (cachedOptions) return cachedOptions;
    return refreshOptionMeta(engineProfile);
  }
  async function refreshOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]> {
    const engine = _resolveEngine(engineProfile);
    const engineId = typeof engineProfile === 'string' ? engineProfile : engineProfile.id;
    if (!engine) throw new Error(`Configured engine not found: ${engineId}.`);
    const pendingEntry = _createCacheEntry(engine, []);
    const options = await EngineRuntimeService.getOptions(engine);
    const currentEngine = _resolveEngine(engineProfile);
    if (currentEngine && _isCacheEntryCurrent(pendingEntry, currentEngine)) _optionMetaByEngineId.set(engineId, { ...pendingEntry, options });
    return options;
  }

  return { listConfiguredEngines, getEngine, getOptionMeta, loadOptionMeta, refreshOptionMeta, validateAnalysisSelection };
});
