export interface IWorkerScriptLoaderConfig {
  databaseName: string;
  storeName: string;
  rootPath: string;
}
export interface IWorkerScriptFile {
  path: string;
  data: Uint8Array<ArrayBuffer>;
}
function _validatePath(path: string) {
  if (!path || /[\\\u0000-\u001f]/.test(path) || /^[a-z]:/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid stored file path: ' + path);
}
function _mimeType(path: string) {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (['js', 'mjs', 'cjs'].includes(extension)) return 'text/javascript';
  if (extension === 'wasm') return 'application/wasm';
  if (extension === 'json' || extension === 'map') return 'application/json';
  if (extension === 'txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}
function _bootstrapWorker(entry: string, assets: Record<string, string>) {
  const scope = globalThis as typeof globalThis & { importScripts(...urls: string[]): void };
  const location = new URL(entry);
  const resolve = (value: string | URL) => {
    const url = new URL(value, location);
    const exact = assets[url.href];
    url.search = '';
    url.hash = '';
    return exact ?? assets[url.href] ?? new URL(value, location).href;
  };
  const load = scope.importScripts.bind(scope);
  const request = scope.fetch.bind(scope);
  const open = XMLHttpRequest.prototype.open;
  scope.importScripts = (...urls) => load(...urls.map(resolve));
  scope.fetch = (input, init) => request(input instanceof Request ? new Request(resolve(input.url), input) : resolve(String(input)), init);
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) { open.call(this, method, resolve(url), async, username, password); };
  Object.defineProperty(scope, 'location', { value: location });
  load(resolve(entry));
}
export class WorkerScriptLoader {
  constructor(private readonly _config: IWorkerScriptLoaderConfig) {}
  async listRoots() {
    const database = await this._openDatabase();
    try {
      const keys = await this._runTransaction(database, 'readonly', store => store.getAllKeys());
      return [...new Set(keys.map(key => (key as string[])[0]!))].sort();
    } finally { database.close(); }
  }
  async listFiles(root: string) {
    _validatePath(root);
    const database = await this._openDatabase();
    try {
      const keys = await this._runTransaction(database, 'readonly', store => store.getAllKeys(IDBKeyRange.bound([root], [root, []])));
      return keys.map(key => (key as string[])[1]!).sort();
    } finally { database.close(); }
  }
  async writeFiles(root: string, files: readonly IWorkerScriptFile[], signal?: AbortSignal) {
    _validatePath(root);
    for (const file of files) _validatePath(file.path);
    signal?.throwIfAborted();
    const database = await this._openDatabase();
    try {
      await this._runTransaction(database, 'readwrite', store => {
        for (const file of files) store.put(file.data, [root, file.path]);
        return store.count(IDBKeyRange.bound([root], [root, []]));
      }, signal);
    } finally { database.close(); }
  }
  async removeFiles(root: string) {
    _validatePath(root);
    const database = await this._openDatabase();
    try { await this._runTransaction(database, 'readwrite', store => store.delete(IDBKeyRange.bound([root], [root, []]))); }
    finally { database.close(); }
  }
  resolveUrl(entryPath: string, appBaseUrl: URL) {
    if (!entryPath.startsWith(this._config.rootPath + '/')) return new URL(entryPath, appBaseUrl);
    _validatePath(entryPath);
    return new URL(entryPath.split('/').map(encodeURIComponent).join('/'), appBaseUrl);
  }
  isStoredUrl(url: URL, appBaseUrl: URL) {
    const root = new URL(this._config.rootPath + '/', appBaseUrl);
    return url.protocol === root.protocol && url.host === root.host && url.pathname.startsWith(root.pathname);
  }
  async createWorker(entryUrl: URL, appBaseUrl: URL, signal?: AbortSignal, options?: WorkerOptions) {
    signal?.throwIfAborted();
    let files: IWorkerScriptFile[] = [];
    let rootUrl = new URL('./', entryUrl);
    if (this.isStoredUrl(entryUrl, appBaseUrl)) {
      const prefix = new URL(this._config.rootPath + '/', appBaseUrl);
      const folder = entryUrl.pathname.slice(prefix.pathname.length).split('/')[0]!;
      const name = decodeURIComponent(folder);
      if (name.includes('/')) throw new Error('Invalid stored file path: ' + name);
      files = await this._readFiles(this._config.rootPath + '/' + name, signal);
      rootUrl = new URL(folder + '/', prefix);
      if (!files.some(file => new URL(file.path.split('/').map(encodeURIComponent).join('/'), rootUrl).pathname === entryUrl.pathname)) throw new Error('Stored worker entry not found: ' + entryUrl.href);
    }
    signal?.throwIfAborted();
    return this._createWorker(entryUrl, rootUrl, files, options);
  }
  private _createWorker(entryUrl: URL, rootUrl: URL, files: readonly IWorkerScriptFile[], options?: WorkerOptions) {
    if (!files.length && entryUrl.protocol !== 'file:') return new Worker(entryUrl, options);
    const urls: string[] = [];
    try {
      const assets: Record<string, string> = {};
      for (const file of files) {
        const url = URL.createObjectURL(new Blob([file.data], { type: _mimeType(file.path) }));
        urls.push(url);
        assets[new URL(file.path.split('/').map(encodeURIComponent).join('/'), rootUrl).href] = url;
      }
      const source = '(' + _bootstrapWorker.toString() + ')(' + JSON.stringify(entryUrl.href) + ',' + JSON.stringify(assets) + ');';
      const sourceUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      urls.push(sourceUrl);
      // The returned Worker owns its Blob URLs; callers only need its normal terminate API.
      return new class extends Worker {
        override terminate() {
          super.terminate();
          for (const url of urls.splice(0)) URL.revokeObjectURL(url);
        }
      }(sourceUrl, options);
    } catch (error) {
      for (const url of urls) URL.revokeObjectURL(url);
      throw error;
    }
  }
  private async _readFiles(root: string, signal?: AbortSignal) {
    _validatePath(root);
    const database = await this._openDatabase();
    try {
      let keys!: IDBRequest<IDBValidKey[]>;
      const data = await this._runTransaction(database, 'readonly', store => {
        const range = IDBKeyRange.bound([root], [root, []]);
        keys = store.getAllKeys(range);
        return store.getAll(range);
      }, signal);
      return keys.result.map((key, index): IWorkerScriptFile => ({ path: (key as string[])[1]!, data: data[index] }));
    } finally { database.close(); }
  }
  private _openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Stored file storage is unavailable.'));
      const request = indexedDB.open(this._config.databaseName, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(this._config.storeName); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  private _runTransaction<T>(database: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, signal?: AbortSignal) {
    return new Promise<T>((resolve, reject) => {
      signal?.throwIfAborted();
      const transaction = database.transaction(this._config.storeName, mode);
      let request: IDBRequest<T>;
      let actionError: unknown;
      const _cancel = () => { transaction.abort(); };
      transaction.oncomplete = () => { signal?.removeEventListener('abort', _cancel); resolve(request.result); };
      transaction.onabort = () => {
        signal?.removeEventListener('abort', _cancel);
        reject((signal?.aborted ? signal.reason : actionError ?? transaction.error) ?? new Error('Stored file transaction was aborted.'));
      };
      transaction.onerror = () => {};
      signal?.addEventListener('abort', _cancel, { once: true });
      try {
        signal?.throwIfAborted();
        request = action(transaction.objectStore(this._config.storeName));
      } catch (error) { actionError = error; if (!signal?.aborted) transaction.abort(); }
    });
  }
}
