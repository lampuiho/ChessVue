import { PlatformError, PlatformErrorKind } from '@/contracts';
import { markRaw } from 'vue';
import type { IProcessManager, IProcess } from '@/contracts/platform';
import { StockfishConfig } from '@/config/StockfishConfig';
import { BrowserUciTransport } from './BrowserUciTransport';

export type BrowserEngineRegistry = Map<IProcess, BrowserUciTransport>;
export class BrowserProcessManager implements IProcessManager {
  constructor(private readonly _registry: BrowserEngineRegistry, private readonly _createWorker = (url: URL): Worker => new Worker(url, { name: 'ChessVue UCI' })) {}
  async spawnProcess(executablePath: string, args: string[] = []): Promise<IProcess> {
    if (args.length) throw this._startError('Browser engines do not accept desktop command-line arguments.');
    const url = this._resolveWorkerUrl(executablePath);
    try {
      const worker = this._createWorker(url);
      const process = markRaw(worker) as unknown as IProcess;
      this._registry.set(process, new BrowserUciTransport(worker, () => this._registry.delete(process)));
      return process;
    } catch (error) {
      throw this._startError('The UCI engine worker could not be started.', String(error));
    }
  }
  assertProcessOpen(process: IProcess) {
    this._requireTransport(process);
  }
  async stopProcess(process: IProcess) {
    this._requireTransport(process).terminate();
  }
  async restartProcess(process: IProcess, executablePath: string, args?: string[]): Promise<IProcess> {
    await this.stopProcess(process);
    return this.spawnProcess(executablePath, args);
  }
  dispose() {
    for (const transport of [...this._registry.values()]) transport.terminate();
  }
  private _requireTransport(handle: IProcess): BrowserUciTransport {
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
