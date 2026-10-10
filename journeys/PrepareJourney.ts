import { PlatformErrorKind } from '@/contracts';
import type { IStorageAdapter } from '@/contracts/platform';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';
import { getMockNodePath, getMockNwjs } from '@/utility/nwjs/NwjsMockUtility';
import { setNwjsOverride } from '@/utility/nwjs/NwjsUtility';
import { JourneyFileSystem } from './JourneyFileSystem';
import { ScriptedEngine } from './ScriptedEngine';
import type { IJourneyApi } from './Journey';

function createDialogs(api: IJourneyApi, fs: JourneyFileSystem) {
  let importPath: string | null = 'imports/valid.json';
  let exportPath: string | null | undefined;
  api.chooseImport = (path) => { importPath = path; };
  api.chooseExport = (path) => { exportPath = path; };
  function resolve(path: string | null, operation: string): string {
    if (path === null) throw { kind: PlatformErrorKind.Cancelled, operation, message: 'Journey file dialog cancelled.' };
    return path;
  }
  return (storage: IStorageAdapter) => {
    storage.showOpenDialog = async () => {
      const path = resolve(importPath, 'showOpenDialog');
      if (fs.readFile(path) === undefined) throw { kind: PlatformErrorKind.NotFound, operation: 'showOpenDialog', message: `Journey file not found: ${path}.` };
      return path;
    };
    storage.showSaveDialog = async (suggested) => resolve(exportPath === undefined ? `exports/${getMockNodePath().basename(suggested ?? 'game.json')}` : exportPath, 'showSaveDialog');
  };
}
export async function prepareJourney(run: { name: string; id: string }, storage = window.sessionStorage) {
  // Install the platform seam before importing services or creating any stores.
  setNwjsOverride(getMockNwjs());
  const { createJourney, journeyCatalogue } = await import('./index');
  const selectionKey = `chessvue:journey:${run.id}:selection`;
  const query = new URLSearchParams(window.location.search);
  const name = query.get('journey') ?? storage.getItem(selectionKey) ?? run.name;
  const seed = createJourney(name);
  storage.setItem(selectionKey, name);
  const key = `chessvue:journey:${run.id}:${name}`;
  if (query.get('reset') === '1') storage.removeItem(key);
  const fs = new JourneyFileSystem(storage, key, seed.files);
  setNodeModuleOverrides({
    fs: fs as unknown as typeof import('node:fs'), path: getMockNodePath(),
    childProcess: { spawn: ((path: string) => new ScriptedEngine(path)) as unknown as typeof import('node:child_process')['spawn'] },
  });
  const api: IJourneyApi = {
    ...journeyCatalogue[name]!, name, gameIds: seed.gameIds, ready: false,
    listFiles: () => fs.listFiles(), readFile: (path) => fs.readFile(path),
    chooseImport: () => {}, chooseExport: () => {}, reset: () => { fs.reset(); window.location.reload(); },
  };
  const installDialogs = createDialogs(api, fs);
  window.chessVueJourney = api;
  // App restores its persisted route after loading games, just as on a normal launch.
  window.history.replaceState({}, '', '/home');
  return { api, fs, installDialogs };
}
