import { markRaw } from 'vue';
import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import { EngineClientType, type IProcess } from '@/contracts/platform';
import { PlatformError } from '@/contracts/PlatformError';
import { WorkerProcessManagerBase } from '@/platform/base/WorkerProcessManagerBase';
import { getNodeChildProcess, getNodePath, getNodeUrl } from '@/utility/nwjs/NodeUtility';
import { isProcessOpen, type ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export class NwjsProcessManager extends WorkerProcessManagerBase {
  private readonly _childProcess = getNodeChildProcess();
  private readonly _nativeProcesses = new Set<ISpawnedProcess>();
  private _disposeWork?: Promise<void>;
  private _disposed = false;
  constructor(private readonly _clientType: EngineClientType) { super(); }
  override async spawnProcess(entryPath: string, args: string[] = []) {
    if (this._clientType === EngineClientType.UciWorker) return super.spawnProcess(entryPath, args);
    if (this._disposed) throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', 'The engine process manager was disposed.');
    const process = this._childProcess.spawn(entryPath, args, { stdio: 'pipe' });
    this._nativeProcesses.add(process);
    process.once('exit', () => { this._nativeProcesses.delete(process); });
    return new Promise<ISpawnedProcess>((resolve, reject) => {
      const _handleSpawn = () => {
        process.stdout.setEncoding('utf8');
        process.stderr.setEncoding('utf8');
        _cleanup();
        if (this._disposed) return reject(_createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', 'The engine process manager was disposed.'));
        resolve(markRaw(process));
      };
      const _handleError = (error: Error) => {
        this._nativeProcesses.delete(process);
        _cleanup();
        reject(_createPlatformError(PlatformErrorKind.ProcessStartFailed, 'spawnProcess', 'Process failed to start: ' + entryPath + '.', error.message));
      };
      const _cleanup = () => {
        process.removeListener('spawn', _handleSpawn);
        process.removeListener('error', _handleError);
      };
      process.once('spawn', _handleSpawn);
      process.once('error', _handleError);
    });
  }
  override assertProcessOpen(process: IProcess) {
    if (this._clientType === EngineClientType.UciWorker) return super.assertProcessOpen(process);
    if (!isProcessOpen(process as ISpawnedProcess)) throw _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'process', 'Engine process is no longer running.');
  }
  override async stopProcess(process: IProcess) {
    if (this._clientType === EngineClientType.UciWorker) return super.stopProcess(process);
    if (!isProcessOpen(process as ISpawnedProcess)) return;
    await new Promise<void>((resolve) => {
      const _finish = () => {
        process.removeListener('exit', _finish);
        resolve();
      };
      process.once('exit', _finish);
      try { if (!process.kill()) _finish(); }
      catch { _finish(); }
    });
  }
  override dispose() {
    this._disposed = true;
    return this._disposeWork ??= this._disposeProcesses();
  }
  private async _disposeProcesses() {
    const nativeStops = Array.from(this._nativeProcesses, process => this.stopProcess(process));
    await Promise.allSettled([super.dispose(), ...nativeStops]);
  }
  protected override _resolveWorkerUrl(entryPath: string): URL {
    const failure = { kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'The engine entry must be a local script or an app URL.' };
    if (!entryPath.trim()) throw new PlatformError(failure);
    if (getNodePath().isAbsolute(entryPath)) return new URL(getNodeUrl().pathToFileURL(entryPath).href);
    const appBaseUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
    let url: URL;
    try { url = new URL(entryPath, appBaseUrl); } catch { throw new PlatformError(failure); }
    if (url.protocol === 'file:') return url;
    if (url.protocol === 'chrome-extension:' && url.protocol === appBaseUrl.protocol && url.host === appBaseUrl.host) return url;
    if (['http:', 'https:'].includes(url.protocol) && url.origin === appBaseUrl.origin) return url;
    throw new PlatformError(failure);
  }
}
