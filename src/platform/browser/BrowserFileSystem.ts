import { z } from 'zod';
import { PlatformError, PlatformErrorKind } from '@/contracts';
import type { IFileSystemEntry, IWriteTextFileOptions } from '@/contracts/platform';
import { SaveTimestamp } from '@/utility/date';

const snapshotSchema = z.object({
  directories: z.array(z.string()),
  files: z.record(z.object({ raw: z.string(), modifiedAt: z.number().finite() })),
});
type FileSystemSnapshot = z.infer<typeof snapshotSchema>;
export function normaliseBrowserPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/') || '.';
}
function _parentPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
}
export class BrowserFileSystem {
  constructor(private readonly _storage: Storage, private readonly _key = 'chessvue:files:v1') {}
  listFiles(): string[] {
    return Object.keys(this._read().files).sort();
  }
  readFile(path: string): string | undefined {
    return this._read().files[normaliseBrowserPath(path)]?.raw;
  }
  readTextFile(path: string): string {
    const raw = this.readFile(path);
    if (raw === undefined) this._fail(PlatformErrorKind.NotFound, 'readTextFile', path);
    return raw;
  }
  listDirectory(path: string): IFileSystemEntry[] {
    const snapshot = this._read();
    const target = normaliseBrowserPath(path);
    if (!snapshot.directories.includes(target)) this._fail(PlatformErrorKind.NotFound, 'listDirectory', path);
    const directories = snapshot.directories.filter((entry) => entry !== target && _parentPath(entry) === target).map((entry) => this._entry(entry, true));
    const files = Object.entries(snapshot.files).filter(([entry]) => _parentPath(entry) === target).map(([entry, file]) => ({ ...this._entry(entry, false), lastModifiedUtc: new SaveTimestamp(file.modifiedAt) }));
    return [...directories, ...files].sort((left, right) => left.name.localeCompare(right.name));
  }
  ensureDirectory(path: string) {
    const snapshot = this._read();
    this._ensureDirectory(snapshot, normaliseBrowserPath(path));
    this._write(snapshot);
  }
  writeTextFile(path: string, raw: string, options: IWriteTextFileOptions = {}) {
    const target = normaliseBrowserPath(path);
    const snapshot = this._read();
    if (snapshot.directories.includes(target)) this._fail(PlatformErrorKind.InvalidOperation, 'writeTextFile', path);
    if (snapshot.files[target] && !options.overwrite) this._fail(PlatformErrorKind.AlreadyExists, 'writeTextFile', path);
    const parent = _parentPath(target);
    if (options.ensureParentDirectory) this._ensureDirectory(snapshot, parent);
    if (!snapshot.directories.includes(parent)) this._fail(PlatformErrorKind.NotFound, 'writeTextFile', parent);
    const modifiedAt = Object.values(snapshot.files).reduce((latest, file) => Math.max(latest, file.modifiedAt + 1), Date.now());
    snapshot.files[target] = { raw, modifiedAt };
    this._write(snapshot);
  }
  deleteFile(path: string) {
    const snapshot = this._read();
    const target = normaliseBrowserPath(path);
    if (!snapshot.files[target]) this._fail(PlatformErrorKind.NotFound, 'deleteFile', path);
    delete snapshot.files[target];
    this._write(snapshot);
  }
  private _entry(path: string, isDirectory: boolean): IFileSystemEntry {
    return { path, name: path.slice(path.lastIndexOf('/') + 1), isDirectory };
  }
  private _ensureDirectory(snapshot: FileSystemSnapshot, path: string) {
    const parts = path === '.' ? [] : path.split('/');
    for (let index = 1; index <= parts.length; index++) {
      const directory = parts.slice(0, index).join('/');
      if (snapshot.files[directory]) this._fail(PlatformErrorKind.InvalidOperation, 'ensureDirectory', directory);
      if (!snapshot.directories.includes(directory)) snapshot.directories.push(directory);
    }
  }
  private _read(): FileSystemSnapshot {
    let raw: string | null;
    try {
      raw = this._storage.getItem(this._key);
    } catch (error) {
      throw new PlatformError({ kind: PlatformErrorKind.PermissionDenied, operation: 'readStorage', message: 'Browser storage could not be read.', detail: String(error) });
    }
    if (raw === null) return { directories: ['.'], files: Object.create(null) };
    try {
      const snapshot = snapshotSchema.parse(JSON.parse(raw));
      snapshot.files = Object.assign(Object.create(null), snapshot.files);
      return snapshot;
    } catch (error) {
      throw new PlatformError({ kind: PlatformErrorKind.InvalidDocument, operation: 'readStorage', message: 'Browser storage contains an invalid file index.', detail: String(error) });
    }
  }
  private _write(snapshot: FileSystemSnapshot) {
    try {
      this._storage.setItem(this._key, JSON.stringify(snapshot));
    } catch (error) {
      throw new PlatformError({ kind: PlatformErrorKind.PermissionDenied, operation: 'writeStorage', message: 'Browser storage could not be written. Check available space and site permissions.', detail: String(error) });
    }
  }
  private _fail(kind: PlatformErrorKind, operation: string, path: string): never {
    throw new PlatformError({ kind, operation, message: `Browser file operation failed: ${path}.` });
  }
}
