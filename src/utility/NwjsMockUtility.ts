import type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from './NwjsUtility';

interface IMockStorageNodeModules {
  fs: typeof import('node:fs');
  path: typeof import('node:path');
  document: Document;
  createInput(document: Document): HTMLInputElement & { oncancel: ((event: Event) => void) | null };
}
interface IMockProcessNodeModules {
  childProcess: Pick<typeof import('node:child_process'), 'spawn'>;
}
type TListener = (...args: any[]) => void;

class MockEmitter {
  private readonly _listenerByEvent = new Map<string, Set<TListener>>();

  on(eventName: string, listener: TListener): this {
    const listeners = this._listenerByEvent.get(eventName) ?? new Set<TListener>();
    listeners.add(listener);
    this._listenerByEvent.set(eventName, listeners);
    return this;
  }
  once(eventName: string, listener: TListener): this {
    const wrappedListener: TListener = (...args) => {
      this.removeListener(eventName, wrappedListener);
      listener(...args);
    };
    return this.on(eventName, wrappedListener);
  }
  removeListener(eventName: string, listener: TListener): this {
    this._listenerByEvent.get(eventName)?.delete(listener);
    return this;
  }
  protected emit(eventName: string, ...args: any[]): void {
    for (const listener of this._listenerByEvent.get(eventName) ?? []) listener(...args);
  }
}
class MockNwWindow extends MockEmitter implements INwjsWindow {
  hide(): void {}
  close(_force?: boolean): void {}
}
class MockReadableStream extends MockEmitter {
  push(chunk: string): void {
    this.emit('data', chunk);
  }
}
class MockWritableStream {
  constructor(private readonly _writeChunk: (chunk: string) => void) {}

  write(chunk: string | Uint8Array): boolean {
    this._writeChunk(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }
}
class MockChildProcess extends MockEmitter implements ISpawnedProcess {
  readonly stdout = new MockReadableStream() as unknown as NodeJS.ReadableStream;
  readonly stderr = new MockReadableStream() as unknown as NodeJS.ReadableStream;
  readonly stdin = new MockWritableStream((chunk) => {
    const command = chunk.trim();
    if (command === 'uci') queueMicrotask(() => (this.stdout as unknown as MockReadableStream).push('uciok\n'));
    if (command === 'isready') queueMicrotask(() => (this.stdout as unknown as MockReadableStream).push('readyok\n'));
    if (command === 'go') queueMicrotask(() => (this.stdout as unknown as MockReadableStream).push('bestmove (none)\n'));
  }) as unknown as NodeJS.WritableStream;

  constructor() {
    super();
    queueMicrotask(() => {
      this.emit('spawn');
    });
  }
  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit('exit', 0, null);
    });
    return true;
  }
}
class MockDirent {
  constructor(readonly name: string, private readonly _isDirectory: boolean) {}

  isDirectory(): boolean {
    return this._isDirectory;
  }
}
class MockPathModule {
  join(...parts: string[]): string {
    return this.normalise(parts.filter((part) => part.length > 0).join('/'));
  }
  dirname(targetPath: string): string {
    const normalisedPath = this.normalise(targetPath);
    const index = normalisedPath.lastIndexOf('/');
    return index <= 0 ? '.' : normalisedPath.slice(0, index);
  }
  basename(targetPath: string): string {
    const normalisedPath = this.normalise(targetPath);
    const index = normalisedPath.lastIndexOf('/');
    return index < 0 ? normalisedPath : normalisedPath.slice(index + 1);
  }
  private normalise(targetPath: string): string {
    return targetPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  }
}
class MockFsModule {
  readonly promises = {
    access: this.access.bind(this),
    mkdir: this.mkdir.bind(this),
    readdir: this.readdir.bind(this),
    readFile: this.readFile.bind(this),
    stat: this.stat.bind(this),
    unlink: this.unlink.bind(this),
    writeFile: this.writeFile.bind(this),
  };
  private readonly _path = new MockPathModule();
  private readonly _directories = new Set<string>(['.']);
  private readonly _files = new Map<string, { raw: string; mtime: Date }>();
  private _tick = 1;

  private normalise(targetPath: string): string {
    return targetPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  }
  private createNodeError(code: string): NodeJS.ErrnoException {
    const error = new Error(code) as NodeJS.ErrnoException;
    error.code = code;
    return error;
  }
  private ensureDirectoryTree(targetPath: string): void {
    const normalisedPath = this.normalise(targetPath);
    const segments = normalisedPath.split('/');
    for (let index = 1; index <= segments.length; index += 1) {
      const segmentPath = segments.slice(0, index).join('/');
      if (segmentPath.length > 0) this._directories.add(segmentPath);
    }
  }
  private hasEntry(targetPath: string): boolean {
    const normalisedPath = this.normalise(targetPath);
    return this._directories.has(normalisedPath) || this._files.has(normalisedPath);
  }
  private async access(targetPath: string): Promise<void> {
    if (!this.hasEntry(targetPath)) throw this.createNodeError('ENOENT');
  }
  private async mkdir(targetPath: string, _options?: { recursive?: boolean }): Promise<void> {
    this.ensureDirectoryTree(targetPath);
  }
  private async readdir(targetPath: string, _options?: { withFileTypes?: boolean }): Promise<MockDirent[]> {
    const normalisedPath = this.normalise(targetPath);
    if (!this._directories.has(normalisedPath)) throw this.createNodeError('ENOENT');
    const childEntries = new Map<string, boolean>();
    for (const directoryPath of this._directories) {
      if (directoryPath === normalisedPath) continue;
      if (this._path.dirname(directoryPath) === normalisedPath) childEntries.set(this._path.basename(directoryPath), true);
    }
    for (const filePath of this._files.keys()) {
      if (this._path.dirname(filePath) === normalisedPath) childEntries.set(this._path.basename(filePath), false);
    }
    return [...childEntries.entries()].map(([name, isDirectory]) => new MockDirent(name, isDirectory));
  }
  private async writeFile(targetPath: string, raw: string): Promise<void> {
    const normalisedPath = this.normalise(targetPath);
    const parentPath = this._path.dirname(normalisedPath);
    if (!this._directories.has(parentPath)) throw this.createNodeError('ENOENT');
    this._files.set(normalisedPath, { raw, mtime: new Date(this._tick++ * 1000) });
  }
  private async readFile(targetPath: string): Promise<Buffer> {
    const file = this._files.get(this.normalise(targetPath));
    if (file === undefined) throw this.createNodeError('ENOENT');
    return Buffer.from(file.raw, 'utf8');
  }
  private async stat(targetPath: string): Promise<{ mtime: Date }> {
    const file = this._files.get(this.normalise(targetPath));
    if (file === undefined) throw this.createNodeError('ENOENT');
    return { mtime: file.mtime };
  }
  private async unlink(targetPath: string): Promise<void> {
    const normalisedPath = this.normalise(targetPath);
    if (!this._files.delete(normalisedPath)) throw this.createNodeError('ENOENT');
  }
}

const _mockNwWindow = new MockNwWindow();
const _mockNw: INwjsGlobal = { Window: { get: () => _mockNwWindow } };
const _mockPathModule = new MockPathModule() as unknown as typeof import('node:path');
const _mockFsModule = new MockFsModule() as unknown as typeof import('node:fs');
const _mockChildProcessModule = { spawn: (() => new MockChildProcess() as unknown as ReturnType<typeof import('node:child_process')['spawn']>) } as unknown as Pick<typeof import('node:child_process'), 'spawn'>;

export function getMockNwjs(): INwjsGlobal {
  return _mockNw;
}
export function getMockStorageNodeModules(document: Document): IMockStorageNodeModules {
  return {
    fs: _mockFsModule,
    path: _mockPathModule,
    document,
    createInput: (document) => {
      const input = document.createElement('input') as HTMLInputElement & { oncancel: ((event: Event) => void) | null };
      input.oncancel = null;
      input.click = () => {
        queueMicrotask(() => {
          input.oncancel?.(new Event('cancel'));
        });
      };
      return input;
    },
  };
}
export function getMockProcessNodeModules(): IMockProcessNodeModules {
  return { childProcess: _mockChildProcessModule };
}
