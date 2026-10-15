import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IProcessManager, ProcessHandle } from '@/contracts/platform';
import { StockfishConfig } from '@/config/StockfishConfig';
import { BrowserUciTransport } from './BrowserUciTransport';

export type BrowserEngineRegistry = Map<ProcessHandle, BrowserUciTransport>;
export class BrowserProcessManager implements IProcessManager {
  private _nextHandle = 1;
  constructor(private readonly _registry: BrowserEngineRegistry, private readonly _createWorker = (url: URL): Worker => new Worker(url, { name: 'ChessVue UCI' })) {}
  async spawnProcess(executablePath: string, args: string[] = []): Promise<ProcessHandle> {
    if (args.length) throw this._startError('Browser engines do not accept desktop command-line arguments.');
    const url = this._resolveWorkerUrl(executablePath);
    const handle = `worker-${this._nextHandle++}`;
    try {
      const worker = this._createWorker(url);
      this._registry.set(handle, new BrowserUciTransport(worker, () => this._registry.delete(handle)));
      return handle;
    } catch (error) {
      throw this._startError('The UCI engine worker could not be started.', String(error));
    }
  }
  assertProcessHandleOpen(processHandle: ProcessHandle): void {
    this._requireTransport(processHandle);
  }
  async stopProcess(processHandle: ProcessHandle): Promise<void> {
    this._requireTransport(processHandle).terminate();
  }
  async restartProcess(processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle> {
    await this.stopProcess(processHandle);
    return this.spawnProcess(executablePath, args);
  }
  dispose(): void {
    for (const transport of [...this._registry.values()]) transport.terminate();
  }
  private _requireTransport(handle: ProcessHandle): BrowserUciTransport {
    const transport = this._registry.get(handle);
    if (!transport) throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'process', message: `Engine worker handle is no longer valid: ${handle}.` });
    return transport;
  }
  private _resolveWorkerUrl(path: string): URL {
    if (!path.trim() || /^[a-z]:[\\/]|^\\\\|\.exe$/i.test(path)) throw this._startError('Local UCI executables require the desktop app. Use stockfish.js or a browser UCI worker URL.');
    const location = path === StockfishConfig.alias ? `${import.meta.env.BASE_URL}${StockfishConfig.directory}/${StockfishConfig.workerFile}` : path;
    let url: URL;
    try {
      url = new URL(location, window.location.origin + import.meta.env.BASE_URL);
    } catch {
      throw this._startError('The browser UCI worker URL is invalid.');
    }
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) throw this._startError('Browser UCI workers must be served from this site.');
    return url;
  }
  private _startError(message: string, detail?: string): PlatformError {
    return new PlatformError({ kind: PlatformErrorKind.ProcessStartFailed, operation: 'spawnProcess', message, detail });
  }
}
