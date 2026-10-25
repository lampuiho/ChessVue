import { unzip, unzipSync } from 'fflate';
import type { IEngineArchive, IEnginePackage, IEnginePackageFile, IEnginePackageUsage } from '@/contracts/Engine';
import { EngineClientType, EngineInstallationSource } from '@/contracts/Engine';
import { PlatformError, PlatformErrorKind } from '@/contracts/PlatformError';
import { EnginePackageConfig } from '@/config/EnginePackageConfig';
import { StockfishConfig } from '@/config/StockfishConfig';
import { getPlatformTarget, PlatformTarget } from '@/utility/nwjs/NwjsUtility';
import { WorkerScriptLoader } from '@/utility/WorkerScriptLoader';

const _storedFiles = new WorkerScriptLoader(EnginePackageConfig);
function _error(operation: string, error: unknown) {
  if (error instanceof PlatformError) return error;
  return new PlatformError({ kind: PlatformErrorKind.InvalidDocument, operation, message: error instanceof Error ? error.message : 'Engine package files could not be accessed.' });
}
function _decodeArchive(file: IEnginePackageFile, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const names = new Set<string>();
  unzipSync(file.data, { filter: entry => {
    const path = entry.name.endsWith('/') ? entry.name.slice(0, -1) : entry.name;
    if (!path || /[\\\u0000-\u001f]/.test(path) || /^[a-z]:/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid package file path: ' + path);
    if (names.has(entry.name)) throw new Error('Duplicate package path: ' + entry.name);
    names.add(entry.name);
    return false;
  } });
  return new Promise<IEngineArchive>((resolve, reject) => {
    let terminate: (() => void) | undefined;
    const _cancel = () => { terminate?.(); reject(signal?.reason); };
    signal?.addEventListener('abort', _cancel, { once: true });
    try {
      terminate = unzip(file.data, { filter: entry => !entry.name.endsWith('/') }, (error, result) => {
        signal?.removeEventListener('abort', _cancel);
        if (signal?.aborted) reject(signal.reason);
        else if (error) reject(error);
        else resolve({ files: Object.entries(result).map(([path, data]) => ({ path, data: new Uint8Array(data) })) });
      });
    } catch (error) {
      terminate?.();
      signal?.removeEventListener('abort', _cancel);
      reject(error);
    }
  });
}
function _validatePackageFiles(archive: IEngineArchive) {
  if (!archive.files.length) throw new Error('The archive contains no files.');
  const paths = new Set<string>();
  for (const file of archive.files) {
    if (!file.path || /[\\\u0000-\u001f]/.test(file.path) || /^[a-z]:/i.test(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid package file path: ' + file.path);
    if (paths.has(file.path)) throw new Error('Duplicate package file: ' + file.path);
    paths.add(file.path);
  }
  for (const file of archive.files) {
    const parts = file.path.split('/');
    parts.pop();
    while (parts.length) {
      if (paths.has(parts.join('/'))) throw new Error('Conflicting package file/folder: ' + file.path);
      parts.pop();
    }
  }
}
function _assertPackageUnreferenced(packagePath: string, references: readonly IEnginePackageUsage[]) {
  const users = references.filter(reference => reference.clientType === EngineClientType.UciWorker && reference.entryPath.startsWith(packagePath + '/'));
  if (users.length) throw new PlatformError({ kind: PlatformErrorKind.InvalidOperation, operation: 'removeEnginePackage', message: 'Engine files are referenced by: ' + users.map(reference => reference.displayName).join(', ') });
}
export const EnginePackageService = {
  canInstall() { return getPlatformTarget() === PlatformTarget.Browser; },
  async listPackages(): Promise<readonly IEnginePackage[]> {
    const bundled: IEnginePackage = { packagePath: StockfishConfig.directory, displayName: 'stockfish', source: EngineInstallationSource.Bundled, files: [...StockfishConfig.files] };
    if (!this.canInstall()) return [bundled];
    let paths: string[];
    try { paths = await _storedFiles.listRoots(); }
    catch (error) { throw _error('listEnginePackages', error); }
    return [bundled, ...await Promise.all(paths.map(async packagePath => {
      const result: IEnginePackage = { packagePath, displayName: packagePath.slice(EnginePackageConfig.rootPath.length + 1), source: EngineInstallationSource.User, files: [] };
      try { return { ...result, files: await _storedFiles.listFiles(packagePath) }; }
      catch (error) { return { ...result, warning: _error('listEnginePackageFiles', error).message }; }
    }))];
  },
  async browseEngineFile(startDirectory?: string) {
    const { usePlatformService } = await import('@/platform');
    return usePlatformService().getStorageAdapter().showOpenDialog(startDirectory);
  },
  async readArchive(file: IEnginePackageFile, signal?: AbortSignal) {
    try {
      const archive = await _decodeArchive(file, signal);
      signal?.throwIfAborted();
      _validatePackageFiles(archive);
      return archive;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw _error('readEngineArchive', error);
    }
  },
  async install(engineName: string, archive: IEngineArchive, signal?: AbortSignal) {
    if (!this.canInstall()) throw new PlatformError({ kind: PlatformErrorKind.InvalidOperation, operation: 'installEnginePackage', message: 'Engine package import is unavailable on this host.' });
    try { _validatePackageFiles(archive); } catch (error) { throw _error('validateEnginePackageFiles', error); }
    const packagePath = EnginePackageConfig.rootPath + '/' + engineName;
    try { await _storedFiles.writeFiles(packagePath, archive.files, signal); }
    catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw _error('installEnginePackage', error);
    }
    return packagePath;
  },
  async remove(packagePath: string, references: readonly IEnginePackageUsage[]) {
    if (!this.canInstall()) throw new PlatformError({ kind: PlatformErrorKind.InvalidOperation, operation: 'removeEnginePackage', message: 'Engine package removal is unavailable on this host.' });
    const root = EnginePackageConfig.rootPath + '/';
    if (!packagePath.startsWith(root) || !packagePath.slice(root.length) || packagePath.slice(root.length).includes('/')) throw new PlatformError({ kind: PlatformErrorKind.InvalidOperation, operation: 'removeEnginePackage', message: 'Only imported engine folders can be removed.' });
    _assertPackageUnreferenced(packagePath, references);
    try { await _storedFiles.removeFiles(packagePath); }
    catch (error) { throw _error('removeEnginePackage', error); }
  },
};
