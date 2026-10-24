import { PlatformError, PlatformErrorKind } from '@/contracts';
import { markRaw } from 'vue';
import type { IProcessManager, IProcess } from '@/contracts/platform';
import { StockfishConfig } from '@/config/StockfishConfig';
import { BrowserWorkerProcess } from '@/utility/BrowserWorkerProcess';

export class BrowserProcessManager implements IProcessManager {
  private readonly _processes = new Set<BrowserWorkerProcess>();
  async spawnProcess(executablePath: string, args: string[] = []): Promise<IProcess> {
    if (args.length) throw this._startError('Browser engines do not accept desktop command-line arguments.');
    const url = this._resolveWorkerUrl(executablePath);
    let worker: Worker | undefined;
    try {
      worker = new Worker(url, { name: 'ChessVue UCI' });
      const process = markRaw(new BrowserWorkerProcess(worker));
      this._processes.add(process);
      process.once('exit', () => this._processes.delete(process));
      return process;
    } catch (error) {
      worker?.terminate();
      throw this._startError('The UCI engine worker could not be started.', String(error));
    }
  }
  assertProcessOpen(process: IProcess) {
    if (!(process instanceof BrowserWorkerProcess) || process.closed) throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'process', message: 'Engine worker is no longer running.' });
  }
  async stopProcess(process: IProcess) {
    this.assertProcessOpen(process);
    await new Promise<void>((resolve) => {
      process.once('exit', () => resolve());
      process.kill();
    });
  }
  async restartProcess(process: IProcess, executablePath: string, args?: string[]): Promise<IProcess> {
    await this.stopProcess(process);
    return this.spawnProcess(executablePath, args);
  }
  dispose() {
    for (const process of [...this._processes]) process.kill();
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
