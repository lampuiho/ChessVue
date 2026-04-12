import { defineStore } from 'pinia';

import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import { getNodeFs, getNodePath } from '@/utility/nwjs/NodeUtility';
import type { INwjsGlobal } from '@/utility/nwjs/NwjsUtility';

import type { IFileSystemEntry, IStorageAdapter } from '../contracts';

interface IFileDialogInput extends HTMLInputElement {
  oncancel: ((this: GlobalEventHandlers, ev: Event) => any) | null;
}

function createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail: string | null = null): IPlatformError {
  return { kind, operation, message, detail };
}
function normalisePath(path: string): string {
  return path.replace(/\\/g, '/');
}
function mapNodeError(error: unknown, operation: string, fallbackMessage: string): IPlatformError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null;
  if (code === 'ENOENT') return createPlatformError(PlatformErrorKind.NotFound, operation, fallbackMessage);
  if (code === 'EACCES' || code === 'EPERM') return createPlatformError(PlatformErrorKind.PermissionDenied, operation, fallbackMessage);
  return createPlatformError(PlatformErrorKind.InvalidDocument, operation, fallbackMessage, error instanceof Error ? error.message : null);
}
async function _resolveFileDialog(input: IFileDialogInput, operation: 'showSaveDialog' | 'showOpenDialog'): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      input.remove();
      input.onchange = null;
      input.oncancel = null;
    };
    input.onchange = () => {
      const selectedFile = input.files?.[0] as File & { path?: string } | undefined;
      const selectedPath = selectedFile?.path ?? input.value;
      cleanup();
      if (selectedPath.length === 0) return reject(createPlatformError(PlatformErrorKind.Cancelled, operation, 'The file dialog was dismissed without selecting a path.'));
      resolve(normalisePath(selectedPath));
    };
    input.oncancel = () => {
      cleanup();
      reject(createPlatformError(PlatformErrorKind.Cancelled, operation, 'The file dialog was dismissed without selecting a path.'));
    };
    document.body.appendChild(input);
    input.click();
  });
}
function _createFileInput(): IFileDialogInput {
  return document.createElement('input') as IFileDialogInput;
}
export function defineNwjsStorageAdapterStore(_nw: INwjsGlobal) {
  return defineStore('nwjsStorageAdapter', () => {
    const fs = getNodeFs();
    const pathModule = getNodePath();

    async function showSaveDialog(suggestedPath?: string): Promise<string> {
      const input = _createFileInput();
      input.type = 'file';
      if (suggestedPath !== undefined) input.setAttribute('nwsaveas', pathModule.basename(suggestedPath));
      const workingDirectory = suggestedPath === undefined ? null : pathModule.dirname(suggestedPath);
      if (workingDirectory !== null) input.setAttribute('nwworkingdir', workingDirectory);
      return _resolveFileDialog(input, 'showSaveDialog');
    }
    async function showOpenDialog(startDirectory?: string): Promise<string> {
      const input = _createFileInput();
      input.type = 'file';
      if (startDirectory !== undefined) input.setAttribute('nwworkingdir', startDirectory);
      return _resolveFileDialog(input, 'showOpenDialog');
    }
    async function listDirectory(targetPath: string): Promise<IFileSystemEntry[]> {
      try {
        const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
        return await Promise.all(entries.map(async (entry) => {
          const entryPath = pathModule.join(targetPath, entry.name);
          const lastModifiedUtc = entry.isDirectory() ? null : (await fs.promises.stat(entryPath)).mtime.toISOString();
          return { path: normalisePath(entryPath), name: entry.name, isDirectory: entry.isDirectory(), lastModifiedUtc };
        }));
      } catch (error) {
        throw mapNodeError(error, 'listDirectory', `Directory was not found or could not be enumerated: ${targetPath}.`);
      }
    }
    async function ensureDirectory(targetPath: string): Promise<void> {
      try {
        await fs.promises.mkdir(targetPath, { recursive: true });
      } catch (error) {
        throw mapNodeError(error, 'ensureDirectory', `Directory could not be created: ${targetPath}.`);
      }
    }
    async function writeTextFile(targetPath: string, raw: string, overwrite: boolean = false): Promise<void> {
      try {
        if (!overwrite) await fs.promises.access(targetPath).then(() => {
          throw createPlatformError(PlatformErrorKind.AlreadyExists, 'writeTextFile', `File already exists: ${targetPath}.`);
        }).catch((error) => {
          if (typeof error === 'object' && error !== null && 'kind' in error) throw error;
          if (typeof error === 'object' && error !== null && 'code' in error && String((error as { code: unknown }).code) === 'ENOENT') return;
          throw error;
        });
        await fs.promises.mkdir(pathModule.dirname(targetPath), { recursive: true });
        await fs.promises.writeFile(targetPath, raw, 'utf8');
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'kind' in error) throw error;
        throw mapNodeError(error, 'writeTextFile', `File could not be written: ${targetPath}.`);
      }
    }
    async function readTextFile(targetPath: string): Promise<string> {
      try {
        const raw = await fs.promises.readFile(targetPath);
        return new TextDecoder('utf-8', { fatal: true }).decode(raw);
      } catch (error) {
        throw mapNodeError(error, 'readTextFile', `File could not be read as a valid text document: ${targetPath}.`);
      }
    }
    async function deleteFile(targetPath: string): Promise<void> {
      try {
        await fs.promises.unlink(targetPath);
      } catch (error) {
        throw mapNodeError(error, 'deleteFile', `File could not be deleted: ${targetPath}.`);
      }
    }

    const storageAdapter = { showSaveDialog, showOpenDialog, listDirectory, ensureDirectory, writeTextFile, readTextFile, deleteFile } satisfies IStorageAdapter;
    return storageAdapter;
  });
}
