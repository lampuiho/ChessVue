import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IUciTransport } from '../uci/IUciTransport';

export class BrowserUciTransport implements IUciTransport {
  private readonly _lineListeners = new Set<(line: string) => void>();
  private readonly _exitListeners = new Set<(detail?: string) => void>();
  private _closed = false;
  private _exitDetail?: string;
  constructor(private readonly _worker: Worker, private readonly _onClosed: () => void) {
    _worker.addEventListener('message', this._onMessage);
    _worker.addEventListener('error', this._onError);
    _worker.addEventListener('messageerror', this._onMessageError);
  }
  write(command: string): void {
    if (this._closed) throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'engineClient', message: 'The engine worker has closed.' });
    try {
      this._worker.postMessage(command);
    } catch (error) {
      this.terminate(String(error));
      throw new PlatformError({ kind: PlatformErrorKind.UnexpectedExit, operation: 'engineClient', message: 'The engine worker could not receive a command.', detail: String(error) });
    }
  }
  subscribe(onLine: (line: string) => void, onExit: (detail?: string) => void): () => void {
    if (this._closed) {
      queueMicrotask(() => onExit(this._exitDetail));
      return () => {};
    }
    this._lineListeners.add(onLine);
    this._exitListeners.add(onExit);
    return () => { this._lineListeners.delete(onLine); this._exitListeners.delete(onExit); };
  }
  terminate(detail = 'Engine worker terminated.'): void {
    if (this._closed) return;
    this._closed = true;
    this._exitDetail = detail;
    this._worker.removeEventListener('message', this._onMessage);
    this._worker.removeEventListener('error', this._onError);
    this._worker.removeEventListener('messageerror', this._onMessageError);
    this._worker.terminate();
    this._onClosed();
    for (const listener of [...this._exitListeners]) listener(detail);
    this._lineListeners.clear();
    this._exitListeners.clear();
  }
  private readonly _onMessage = (event: MessageEvent<unknown>): void => {
    if (typeof event.data !== 'string' || this._closed) return;
    for (const line of event.data.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
      for (const listener of [...this._lineListeners]) listener(line);
    }
  };
  private readonly _onError = (event: ErrorEvent): void => {
    event.preventDefault();
    this.terminate(event.message || 'The engine worker failed to load or crashed.');
  };
  private readonly _onMessageError = (): void => {
    this.terminate('The engine worker emitted an unreadable message.');
  };
}
