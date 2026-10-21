import type { IJourneyFile } from './Journey';

interface IStoredFile {
  raw: string;
  modifiedAt: number;
}
interface IFileSystemSnapshot {
  directories: string[];
  files: Record<string, IStoredFile>;
}
function _normalise(path: string): string {
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
function _nodeError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}
export class JourneyFileSystem {
  private readonly _directories: Set<string>;
  private readonly _files: Map<string, IStoredFile>;
  private _lastModified = Date.now();
  readonly promises = {
    access: async (path: string) => {
      if (!this._files.has(_normalise(path)) && !this._directories.has(_normalise(path))) throw _nodeError('ENOENT');
    },
    mkdir: async (path: string) => { this._ensureDirectory(path); this._persist(); },
    readFile: async (path: string) => {
      const file = this._files.get(_normalise(path));
      if (!file) throw _nodeError('ENOENT');
      return new TextEncoder().encode(file.raw);
    },
    writeFile: async (path: string, raw: string) => {
      const normalised = _normalise(path);
      if (!this._directories.has(_parentPath(normalised))) throw _nodeError('ENOENT');
      this._lastModified = Math.max(Date.now(), this._lastModified + 1);
      this._files.set(normalised, { raw, modifiedAt: this._lastModified });
      this._persist();
    },
    stat: async (path: string) => {
      const file = this._files.get(_normalise(path));
      if (!file) throw _nodeError('ENOENT');
      return { mtime: new Date(file.modifiedAt) };
    },
    unlink: async (path: string) => {
      if (!this._files.delete(_normalise(path))) throw _nodeError('ENOENT');
      this._persist();
    },
    readdir: async (path: string) => this._readDirectory(path),
  };
  constructor(private readonly _storage: Storage, private readonly _key: string, seed: IJourneyFile[]) {
    const saved = _storage.getItem(_key);
    const snapshot: IFileSystemSnapshot = saved ? JSON.parse(saved) : { directories: ['.'], files: {} };
    this._directories = new Set(snapshot.directories);
    this._files = new Map(Object.entries(snapshot.files));
    for (const file of this._files.values()) this._lastModified = Math.max(this._lastModified, file.modifiedAt);
    if (!saved) {
      for (const file of seed) {
        const path = _normalise(file.path);
        this._ensureDirectory(_parentPath(path));
        this._files.set(path, { raw: file.raw, modifiedAt: file.modifiedAt ?? Date.parse('2026-10-01T12:00:00.000Z') });
      }
      this._persist();
    }
  }
  listFiles(): string[] {
    return [...this._files.keys()].sort();
  }
  readFile(path: string): string | undefined {
    return this._files.get(_normalise(path))?.raw;
  }
  reset() {
    this._storage.removeItem(this._key);
  }
  private _ensureDirectory(path: string) {
    const parts = _normalise(path).split('/');
    for (let index = 1; index <= parts.length; index += 1) this._directories.add(parts.slice(0, index).join('/'));
  }
  private _readDirectory(path: string) {
    const normalised = _normalise(path);
    if (!this._directories.has(normalised)) throw _nodeError('ENOENT');
    const children = new Map<string, boolean>();
    for (const directory of this._directories) {
      if (directory !== normalised && _parentPath(directory) === normalised) children.set(directory, true);
    }
    for (const file of this._files.keys()) {
      if (_parentPath(file) === normalised) children.set(file, false);
    }
    return [...children].map(([child, directory]) => ({ name: child.slice(child.lastIndexOf('/') + 1), isDirectory: () => directory }));
  }
  private _persist() {
    const snapshot: IFileSystemSnapshot = { directories: [...this._directories], files: Object.fromEntries(this._files) };
    this._storage.setItem(this._key, JSON.stringify(snapshot));
  }
}
