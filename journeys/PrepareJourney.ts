import { PlatformErrorKind } from '@/contracts';
import type { IStorageAdapter } from '@/contracts/platform';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';
import { getMockNodePath, getMockNwjs } from '@/utility/nwjs/NwjsMockUtility';
import { setBrowserPlatformOptions } from '@/platform/browser/BrowserPlatformService';
import { BrowserFileSystem } from '@/platform/browser/BrowserFileSystem';
import { defineNwjsProcessManagerStore } from '@/platform/nwjs/NwjsProcessManager';
import { defineNwjsUciEngineClientStore } from '@/platform/nwjs/NwjsUciEngineClient';
import { JourneyFileSystem } from './JourneyFileSystem';
import { changeManagedFile } from './JourneyStorageControl';
import { ScriptedEngine } from './runtime/engine/ScriptedEngine';
import { JourneyEngineBarrier } from './runtime/engine/JourneyEngineBarrier';
import { JourneyStorageBarrier } from './runtime/storage/JourneyStorageBarrier';
import type { IJourneyApi } from './Journey';

function _createDialogs(api: IJourneyApi, fs: BrowserFileSystem) {
  let importPath: string | null = 'imports/valid.json';
  let exportPath: string | null | undefined;
  api.chooseImport = (path) => { importPath = path; };
  api.chooseExport = (path) => { exportPath = path; };
  function _resolve(path: string | null, operation: string): string {
    if (path === null) throw { kind: PlatformErrorKind.Cancelled, operation, message: 'Journey file dialog cancelled.' };
    return path;
  }
  return (storage: IStorageAdapter) => {
    storage.showOpenDialog = async () => {
      const path = _resolve(importPath, 'showOpenDialog');
      if (fs.readFile(path) === undefined) throw { kind: PlatformErrorKind.NotFound, operation: 'showOpenDialog', message: `Journey file not found: ${path}.` };
      return path;
    };
    storage.showSaveDialog = async (suggested) => _resolve(exportPath === undefined ? `exports/${getMockNodePath().basename(suggested ?? 'game.json')}` : exportPath, 'showSaveDialog');
  };
}
function _installBrowserPlatform(storage: Storage, key: string, fs: JourneyFileSystem, engines: JourneyEngineBarrier) {
  const nw = getMockNwjs();
  setNodeModuleOverrides({
    fs: fs as unknown as typeof import('node:fs'), path: getMockNodePath(),
    childProcess: { spawn: ((path: string) => new ScriptedEngine(path, engines)) as unknown as typeof import('node:child_process')['spawn'] },
  });
  setBrowserPlatformOptions({
    storage, storageKey: key,
    createEngineServices: () => {
      return { processManager: defineNwjsProcessManagerStore(nw)(), engineClient: defineNwjsUciEngineClientStore(nw)() };
    },
  });
}
export async function prepareJourney(run: { name: string; id: string }, storage = window.sessionStorage) {
  // Install the platform seam before importing services or creating any stores.
  const { createJourney, journeyCatalogue } = await import('./index');
  const selectionKey = `chessvue:journey:${run.id}:selection`;
  const query = new URLSearchParams(window.location.search);
  const name = query.get('journey') ?? storage.getItem(selectionKey) ?? run.name;
  const variantKey = `chessvue:journey:${run.id}:variant:${name}`;
  const variant = query.has('journey') ? query.get('variant') : query.get('variant') ?? storage.getItem(variantKey);
  const seed = createJourney(name, Date.now(), variant ?? undefined);
  if (variant) storage.setItem(variantKey, variant);
  else storage.removeItem(variantKey);
  storage.setItem(selectionKey, name);
  const key = `chessvue:journey:${run.id}:${name}${variant ? `:${variant}` : ''}`;
  if (query.get('reset') === '1') storage.removeItem(key);
  const fs = new JourneyFileSystem(storage, key, seed.files);
  const engines = new JourneyEngineBarrier();
  const storageBarrier = new JourneyStorageBarrier();
  for (const fault of seed.storageFaults ?? []) storageBarrier.failNext(fault.operation, fault.path, fault.count);
  _installBrowserPlatform(storage, key, fs, engines);
  const browserFiles = new BrowserFileSystem(storage, key);
  const api: IJourneyApi = {
    ...journeyCatalogue[name]!, name, gameIds: seed.gameIds, ready: false, engines, storage: storageBarrier,
    listFiles: () => browserFiles.listFiles(), readFile: (path) => browserFiles.readFile(path),
    changeFile: (path, raw) => changeManagedFile(browserFiles, path, raw),
    chooseImport: () => {}, chooseExport: () => {}, reset: () => { engines.reset(); storageBarrier.reset(); fs.reset(); window.location.reload(); },
  };
  const installDialogs = _createDialogs(api, browserFiles);
  window.chessVueJourney = api;
  // App restores its persisted route after loading games, just as on a normal launch.
  window.history.replaceState(null, '', '/home');
  return { api, fs, installDialogs: (adapter: IStorageAdapter) => { installDialogs(adapter); storageBarrier.install(adapter); } };
}
