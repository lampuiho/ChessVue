import type { IJourneyFile } from './Journey';

interface IStoredFile {
  raw: string;
  modifiedAt: number;
}
interface IFileSystemSnapshot {
  directories: string[];
  files: Record<string, IStoredFile>;
}
function normalise(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/') || '.';
}
function parentPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
}
function nodeError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}
export class JourneyFileSystem {
  private readonly _directories: Set<string>;
  private readonly _files: Map<string, IStoredFile>;
  private _lastModified = Date.now();
  readonly promises = {
    access: async (path: string) => {
      if (!this._files.has(normalise(path)) && !this._directories.has(normalise(path))) throw nodeError('ENOENT');
    },
    mkdir: async (path: string) => { this.ensureDirectory(path); this.persist(); },
    readFile: async (path: string) => {
      const file = this._files.get(normalise(path));
      if (!file) throw nodeError('ENOENT');
      return new TextEncoder().encode(file.raw);
    },
    writeFile: async (path: string, raw: string) => {
      const normalised = normalise(path);
      if (!this._directories.has(parentPath(normalised))) throw nodeError('ENOENT');
      this._lastModified = Math.max(Date.now(), this._lastModified + 1);
      this._files.set(normalised, { raw, modifiedAt: this._lastModified });
      this.persist();
    },
    stat: async (path: string) => {
      const file = this._files.get(normalise(path));
      if (!file) throw nodeError('ENOENT');
      return { mtime: new Date(file.modifiedAt) };
    },
    unlink: async (path: string) => {
      if (!this._files.delete(normalise(path))) throw nodeError('ENOENT');
      this.persist();
    },
    readdir: async (path: string) => this.readDirectory(path),
  };
  constructor(private readonly _storage: Storage, private readonly _key: string, seed: IJourneyFile[]) {
    const saved = _storage.getItem(_key);
    const snapshot: IFileSystemSnapshot = saved ? JSON.parse(saved) : { directories: ['.'], files: {} };
    this._directories = new Set(snapshot.directories);
    this._files = new Map(Object.entries(snapshot.files));
    for (const file of this._files.values()) this._lastModified = Math.max(this._lastModified, file.modifiedAt);
    if (!saved) {
      for (const file of seed) {
        const path = normalise(file.path);
        this.ensureDirectory(parentPath(path));
        this._files.set(path, { raw: file.raw, modifiedAt: file.modifiedAt ?? Date.parse('2026-10-01T12:00:00.000Z') });
      }
      this.persist();
    }
  }
  listFiles(): string[] {
    return [...this._files.keys()].sort();
  }
  readFile(path: string): string | undefined {
    return this._files.get(normalise(path))?.raw;
  }
  reset(): void {
    this._storage.removeItem(this._key);
  }
  private ensureDirectory(path: string): void {
    const parts = normalise(path).split('/');
    for (let index = 1; index <= parts.length; index += 1) this._directories.add(parts.slice(0, index).join('/'));
  }
  private readDirectory(path: string) {
    const normalised = normalise(path);
    if (!this._directories.has(normalised)) throw nodeError('ENOENT');
    const children = new Map<string, boolean>();
    for (const directory of this._directories) {
      if (directory !== normalised && parentPath(directory) === normalised) children.set(directory, true);
    }
    for (const file of this._files.keys()) {
      if (parentPath(file) === normalised) children.set(file, false);
    }
    return [...children].map(([child, directory]) => ({ name: child.slice(child.lastIndexOf('/') + 1), isDirectory: () => directory }));
  }
  private persist(): void {
    const snapshot: IFileSystemSnapshot = { directories: [...this._directories], files: Object.fromEntries(this._files) };
    this._storage.setItem(this._key, JSON.stringify(snapshot));
  }
}
