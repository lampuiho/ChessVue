import { defineStore } from 'pinia';
import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IStorageAdapter, IWriteTextFileOptions } from '@/contracts/platform';
import { BrowserFileSystem } from './BrowserFileSystem';

function _readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new PlatformError({ kind: PlatformErrorKind.PermissionDenied, operation: 'showOpenDialog', message: 'The selected file could not be read.' }));
    reader.onload = () => {
      try {
        resolve(new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer));
      } catch {
        reject(new PlatformError({ kind: PlatformErrorKind.InvalidDocument, operation: 'showOpenDialog', message: 'The selected file is not valid UTF-8 text.' }));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
function _selectFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    const cleanup = () => { input.remove(); input.onchange = null; input.oncancel = null; };
    const cancel = () => {
      cleanup();
      reject(new PlatformError({ kind: PlatformErrorKind.Cancelled, operation: 'showOpenDialog', message: 'The file picker was cancelled.' }));
    };
    input.oncancel = cancel;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return cancel();
      cleanup();
      resolve(file);
    };
    document.body.appendChild(input);
    try {
      input.click();
    } catch (error) {
      cleanup();
      reject(new PlatformError({ kind: PlatformErrorKind.PermissionDenied, operation: 'showOpenDialog', message: 'The file picker could not be opened.', detail: String(error) }));
    }
  });
}
function _download(name: string, raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export function defineBrowserStorageAdapterStore(storage?: Storage, storageKey?: string) {
  return defineStore('browserStorageAdapter', () => {
    const files = new BrowserFileSystem(storage ?? window.localStorage, storageKey);
    const imports = new Map<string, string>();
    const downloads = new Map<string, string>();
    async function showOpenDialog(): Promise<string> {
      const file = await _selectFile();
      const path = `browser-import:${crypto.randomUUID()}/${file.name}`;
      imports.set(path, await _readFile(file));
      return path;
    }
    async function showSaveDialog(suggestedPath = 'game.json'): Promise<string> {
      const name = suggestedPath.replace(/\\/g, '/').split('/').pop() || 'game.json';
      const path = `browser-download:${crypto.randomUUID()}/${name}`;
      downloads.set(path, name);
      return path;
    }
    async function writeTextFile(path: string, raw: string, options?: IWriteTextFileOptions) {
      const name = downloads.get(path);
      if (name === undefined) return files.writeTextFile(path, raw, options);
      _download(name, raw);
      downloads.delete(path);
    }
    async function readTextFile(path: string): Promise<string> {
      const raw = imports.get(path);
      if (raw === undefined) return files.readTextFile(path);
      imports.delete(path);
      return raw;
    }
    return {
      showOpenDialog, showSaveDialog, writeTextFile, readTextFile,
      listDirectory: async (path) => files.listDirectory(path),
      ensureDirectory: async (path) => files.ensureDirectory(path),
      deleteFile: async (path) => files.deleteFile(path),
    } satisfies IStorageAdapter;
  });
}
