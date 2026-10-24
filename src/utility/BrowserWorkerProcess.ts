import { PlatformError, PlatformErrorKind } from '@/contracts/PlatformError';
import type { IProcess, IProcessInput, IProcessOutput } from '@/contracts/platform/IProcess';

type ProcessExitListener = (code: number | null, signal: string | null) => void;
export class BrowserWorkerProcess implements IProcess {
  private readonly _dataListeners: Array<(chunk: string) => void> = [];
  private readonly _exitListeners: ProcessExitListener[] = [];
  private _closed = false;
  private _exitDetail?: string;
  private _inputBuffer = '';
  readonly stdin: IProcessInput = { write: (chunk) => this._writeInput(chunk) };
  readonly stdout: IProcessOutput = {
    on: (_event, listener) => {
      if (!this._closed) this._dataListeners.push(listener);
      return this.stdout;
    },
    removeListener: (_event, listener) => {
      const index = this._dataListeners.lastIndexOf(listener);
      if (index >= 0) this._dataListeners.splice(index, 1);
      return this.stdout;
    },
  };
  constructor(private readonly _worker: Worker) {
    _worker.addEventListener('message', this._onMessage);
    _worker.addEventListener('error', this._onError);
    _worker.addEventListener('messageerror', this._onMessageError);
  }
  get closed() { return this._closed; }
  get exitDetail() { return this._exitDetail; }
  once(_event: 'exit', listener: ProcessExitListener) {
    if (!this._closed) this._exitListeners.push(listener);
    return this;
  }
  removeListener(_event: 'exit', listener: ProcessExitListener) {
    const index = this._exitListeners.lastIndexOf(listener);
    if (index >= 0) this._exitListeners.splice(index, 1);
    return this;
  }
  kill() {
    if (this._closed) return false;
    this._close('Engine worker terminated.');
    return true;
  }
  private _writeInput(chunk: string) {
    if (this._closed) throw new PlatformError({ kind: PlatformErrorKind.InvalidProcessHandle, operation: 'engineClient', message: 'The engine worker has closed.' });
    this._inputBuffer += chunk;
    const commands = this._inputBuffer.split(/\r?\n/);
    this._inputBuffer = commands.pop() ?? '';
    try {
      for (const command of commands) this._worker.postMessage(command);
      return true;
    } catch (error) {
      this._close(String(error));
      throw new PlatformError({ kind: PlatformErrorKind.UnexpectedExit, operation: 'engineClient', message: 'The engine worker could not receive a command.', detail: String(error) });
    }
  }
  private _close(detail: string) {
    if (this._closed) return;
    this._closed = true;
    this._exitDetail = detail;
    this._worker.removeEventListener('message', this._onMessage);
    this._worker.removeEventListener('error', this._onError);
    this._worker.removeEventListener('messageerror', this._onMessageError);
    this._worker.terminate();
    for (const listener of this._exitListeners.splice(0)) listener(null, null);
    this._dataListeners.length = 0;
    this._inputBuffer = '';
  }
  private readonly _onMessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== 'string' || this._closed) return;
    const chunk = event.data.endsWith('\n') ? event.data : event.data + '\n';
    for (const listener of [...this._dataListeners]) listener(chunk);
  };
  private readonly _onError = (event: ErrorEvent) => {
    event.preventDefault();
    this._close(event.message || 'The engine worker failed to load or crashed.');
  };
  private readonly _onMessageError = () => {
    this._close('The engine worker emitted an unreadable message.');
  };
}
