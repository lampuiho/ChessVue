import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IStorageAdapter } from '@/contracts/platform';
import { normaliseBrowserPath } from '@/platform/browser/BrowserFileSystem';

export type StorageOperation = 'readTextFile' | 'listDirectory' | 'writeTextFile' | 'deleteFile';
export interface IStorageFault {
  operation: StorageOperation;
  path: string;
  count?: number;
}
interface IStorageRule extends IStorageFault {
  id: number;
  count: number;
  kind?: PlatformErrorKind;
  held: boolean;
}
interface IStorageCall {
  id: number;
  operation: StorageOperation;
  path: string;
  state: 'held' | 'running' | 'succeeded' | 'failed' | 'cancelled';
}
export class JourneyStorageBarrier {
  private _nextId = 0;
  private readonly _rules: IStorageRule[] = [];
  private readonly _calls: IStorageCall[] = [];
  private readonly _pending = new Map<number, { release(): void; cancel(): void }>();
  failNext(operation: StorageOperation, path: string, count = 1, kind = PlatformErrorKind.PermissionDenied) {
    if (!Number.isInteger(count) || count < 1) throw new Error('Choose a positive failure count.');
    this._rules.push({ id: ++this._nextId, operation, path: normaliseBrowserPath(path), count, kind, held: false });
  }
  holdNext(operation: StorageOperation, path: string): number {
    const id = ++this._nextId;
    this._rules.push({ id, operation, path: normaliseBrowserPath(path), count: 1, held: true });
    return id;
  }
  release(id: number) {
    this._pending.get(id)?.release();
  }
  operations(): IStorageCall[] {
    return this._calls.map((call) => ({ ...call }));
  }
  reset() {
    this._rules.splice(0);
    for (const pending of this._pending.values()) pending.cancel();
    this._pending.clear();
    this._calls.splice(0);
  }
  install(storage: IStorageAdapter) {
    const read = storage.readTextFile.bind(storage);
    const list = storage.listDirectory.bind(storage);
    const write = storage.writeTextFile.bind(storage);
    const remove = storage.deleteFile.bind(storage);
    storage.readTextFile = (path) => this._run('readTextFile', path, () => read(path));
    storage.listDirectory = (path) => this._run('listDirectory', path, () => list(path));
    storage.writeTextFile = (path, raw, options) => this._run('writeTextFile', path, () => write(path, raw, options));
    storage.deleteFile = (path) => this._run('deleteFile', path, () => remove(path));
  }
  private async _wait(id: number) {
    try {
      await new Promise<void>((release, reject) => this._pending.set(id, {
        release, cancel: () => reject(new PlatformError({ kind: PlatformErrorKind.Cancelled, operation: 'storageBarrier', message: 'Journey storage operation cancelled.' })),
      }));
    } finally {
      this._pending.delete(id);
    }
  }
  private async _run<T>(operation: StorageOperation, path: string, action: () => Promise<T>): Promise<T> {
    const target = normaliseBrowserPath(path);
    const rule = this._rules.find((candidate) => candidate.operation === operation && candidate.path === target);
    if (rule && --rule.count === 0) this._rules.splice(this._rules.indexOf(rule), 1);
    const call: IStorageCall = { id: rule?.held ? rule.id : ++this._nextId, operation, path: target, state: rule?.held ? 'held' : 'running' };
    this._calls.push(call);
    try {
      if (rule?.kind) throw new PlatformError({ kind: rule.kind, operation, message: `Journey storage ${operation} failed: ${target}. Try again.` });
      // Capture an in-flight read before delivery; held writes/deletes commit only on release.
      const result = rule?.held && (operation === 'readTextFile' || operation === 'listDirectory')
        ? action().then((value) => ({ value }), (error: unknown) => ({ error })) : undefined;
      if (rule?.held) await this._wait(rule.id);
      const captured = await result;
      if (captured && 'error' in captured) throw captured.error;
      const value = captured ? captured.value : await action();
      call.state = 'succeeded';
      return value;
    } catch (error) {
      call.state = error instanceof PlatformError && error.kind === PlatformErrorKind.Cancelled ? 'cancelled' : 'failed';
      throw error;
    }
  }
}
