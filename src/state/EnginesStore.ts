import { defineStore } from 'pinia';
import { shallowReactive, shallowRef } from 'vue';

import { type EngineClientType, type IEngineOptionMeta, type IEngineRecord } from '@/contracts';
import { EngineRuntimeService, UserSettingService } from '@/domain';
import { EnginePackageService } from '@/domain/EnginePackageService';
import { PlatformError, PlatformErrorKind } from '@/contracts/PlatformError';
import type { IEngineArchive, IEnginePackage, IEnginePackageFile, IEnginePackageUsage } from '@/contracts/Engine';

interface IEngineOptionMetaCacheEntry {
  clientType: EngineClientType;
  entryPath: string;
  options: readonly IEngineOptionMeta[];
}

function _getInventory(): IEngineRecord[] {
  return UserSettingService.getSettings().analysis.engineInventory;
}

export const useEnginesStore = defineStore('enginesStore', () => {
  const _optionMetaByEngineId = shallowReactive(new Map<string, IEngineOptionMetaCacheEntry>());

  function _isCacheEntryCurrent(entry: IEngineOptionMetaCacheEntry, engine: IEngineRecord): boolean {
    return entry.clientType === engine.clientType && entry.entryPath === engine.entryPath;
  }
  function _createCacheEntry(engine: IEngineRecord, options: readonly IEngineOptionMeta[]): IEngineOptionMetaCacheEntry {
    return { clientType: engine.clientType, entryPath: engine.entryPath, options };
  }
  function _resolveEngine(engine: IEngineRecord | string): IEngineRecord | undefined {
    return typeof engine === 'string' ? getEngine(engine) : engine;
  }
  function listConfiguredEngines(): IEngineRecord[] {
    return _getInventory();
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

  const _packages = shallowRef<readonly IEnginePackage[]>([]);
  let _packageWork: Promise<unknown> = Promise.resolve();
  let _packageRead: { completion?: Promise<void> } | undefined;
  function _queuePackageWork<T>(action: () => Promise<T>) {
    const work = _packageWork.then(action);
    _packageWork = work.then(() => {}, () => {});
    return work;
  }
  async function _readPackages() { _packages.value = await EnginePackageService.listPackages(); }
  function refreshPackages() {
    if (_packageRead?.completion) return _packageRead.completion;
    const owner: { completion?: Promise<void> } = { completion: _queuePackageWork(_readPackages) };
    const work = owner.completion!;
    _packageRead = owner;
    void work.then(() => { owner.completion = undefined; }, () => { owner.completion = undefined; });
    return work;
  }
  function canInstallPackages() { return EnginePackageService.canInstall(); }
  function listPackages() { return _packages.value; }
  function getPackage(packagePath: string) { return _packages.value.find(engine => engine.packagePath === packagePath); }
  function browseEngineFile(startDirectory?: string) { return EnginePackageService.browseEngineFile(startDirectory); }
  function readArchive(file: IEnginePackageFile, signal?: AbortSignal) { return EnginePackageService.readArchive(file, signal); }
  function installPackage(engineName: string, archive: IEngineArchive, signal?: AbortSignal) {
    _packageRead = undefined;
    return _queuePackageWork(async () => {
      const packagePath = await EnginePackageService.install(engineName, archive, signal);
      try { _packages.value = await EnginePackageService.listPackages(); }
      catch { throw new PlatformError({ kind: PlatformErrorKind.InvalidDocument, operation: 'refreshEnginePackagesAfterInstall', message: 'Engine files were saved, but the folder list could not be refreshed. Refresh the list before continuing.', detail: packagePath }); }
      return packagePath;
    });
  }
  function removePackage(packagePath: string, readReferences: () => readonly IEnginePackageUsage[]) {
    _packageRead = undefined;
    return _queuePackageWork(async () => {
      await EnginePackageService.remove(packagePath, readReferences());
      try { _packages.value = await EnginePackageService.listPackages(); }
      catch { throw new PlatformError({ kind: PlatformErrorKind.InvalidDocument, operation: 'refreshEnginePackagesAfterRemove', message: 'Engine files were removed, but the folder list could not be refreshed.', detail: packagePath }); }
    });
  }
  return { canInstallPackages, refreshPackages, listPackages, getPackage, browseEngineFile, readArchive, installPackage, removePackage, listConfiguredEngines, getEngine, getOptionMeta, loadOptionMeta, refreshOptionMeta, validateAnalysisSelection };
});
