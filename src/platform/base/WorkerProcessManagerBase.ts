import { PlatformError, PlatformErrorKind } from '@/contracts/PlatformError';
import { markRaw } from 'vue';
import type { IProcessManager, IProcess } from '@/contracts/platform';
import { BrowserWorkerProcess } from '@/utility/BrowserWorkerProcess';
import { EnginePackageConfig } from '@/config/EnginePackageConfig';
import { StoredWorkerUtility } from '@/utility/StoredWorkerUtility';

export abstract class WorkerProcessManagerBase implements IProcessManager {
  private readonly _processes = new Set<BrowserWorkerProcess>();
  private readonly _lifetime = new AbortController();
  private readonly _storedFiles = new StoredWorkerUtility(EnginePackageConfig);
  private _packageRegistration?: Promise<void>;
  async spawnProcess(entryPath: string, args: string[] = []): Promise<IProcess> {
    if (args.length) throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Browser engines do not accept desktop command-line arguments.' });
    this._lifetime.signal.throwIfAborted();
    let worker: Worker | undefined;
    try {
      const url = this._resolveWorkerUrl(entryPath);
      if (this._storedFiles.isStoredUrl(url, this._appBaseUrl)) {
        this._packageRegistration ??= this._registerPackageServiceWorker().catch(error => { this._packageRegistration = undefined; throw error; });
        await this._packageRegistration;
      }
      this._lifetime.signal.throwIfAborted();
      worker = new Worker(url, { name: 'ChessVue UCI' });
      const process = markRaw(new BrowserWorkerProcess(worker));
      this._processes.add(process);
      process.once('exit', () => { this._processes.delete(process); });
      return process;
    } catch (error) {
      worker?.terminate();
      if (error instanceof PlatformError) throw error;
      throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'The UCI engine worker could not be started.', detail: String(error) });
    }
  }
  assertProcessOpen(process: IProcess) {
    if (!(process instanceof BrowserWorkerProcess) || process.closed) throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'process', message: 'Engine worker is no longer running.' });
  }
  async stopProcess(process: IProcess) {
    if (!(process instanceof BrowserWorkerProcess) || process.closed) return;
    await new Promise<void>((resolve) => {
      process.once('exit', () => resolve());
      process.kill();
    });
  }
  async restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess> {
    await this.stopProcess(process);
    return this.spawnProcess(entryPath, args);
  }
  async dispose() {
    this._lifetime.abort(new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'The engine process manager was disposed.' }));
    for (const process of [...this._processes]) process.kill();
    await this._storedFiles.dispose();
  }
  protected _resolveWorkerUrl(entryPath: string): URL {
    if (!entryPath.trim() || /^[a-z]:[\\/]|^\\\\|\.exe$/i.test(entryPath)) throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Local UCI executables require the desktop app. Choose a browser engine entry script.' });
    let url: URL;
    try { url = this._storedFiles.resolveUrl(entryPath, this._appBaseUrl); }
    catch { throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'The browser UCI worker URL is invalid.' }); }
    if (url.origin !== this._appBaseUrl.origin || !['http:', 'https:'].includes(url.protocol)) throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Browser UCI workers must be served from this site.' });
    return url;
  }
  private get _appBaseUrl() { return new URL(import.meta.env.BASE_URL, document.baseURI); }
  private async _registerPackageServiceWorker() {
    try { await this._storedFiles.register(this._appBaseUrl, this._lifetime.signal); }
    catch (error) {
      if (error instanceof PlatformError) throw error;
      throw new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message: 'Stored engine files could not be served.', detail: String(error) });
    }
  }
}
