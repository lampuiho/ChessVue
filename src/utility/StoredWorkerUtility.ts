export interface IStoredWorkerConfig {
  databaseName: string;
  storeName: string;
  rootPath: string;
  serviceWorkerPath: string;
}
export interface IStoredWorkerFile {
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
export class StoredWorkerUtility {
  private readonly _lifetime = new AbortController();
  private _registrationWork?: Promise<ServiceWorkerRegistration>;
  private _registration?: ServiceWorkerRegistration;
  constructor(private readonly _config: IStoredWorkerConfig) {}
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
  async writeFiles(root: string, files: readonly IStoredWorkerFile[], signal?: AbortSignal) {
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
    return url.origin === root.origin && url.pathname.startsWith(root.pathname);
  }
  async register(appBaseUrl: URL, signal?: AbortSignal) {
    this._lifetime.signal.throwIfAborted();
    signal?.throwIfAborted();
    const container = navigator.serviceWorker;
    if (!container) throw new Error('Stored scripts require service-worker support.');
    const scriptUrl = new URL(this._config.serviceWorkerPath, appBaseUrl);
    for (const key of ['databaseName', 'storeName', 'rootPath'] as const) scriptUrl.searchParams.set(key, this._config[key]);
    this._registrationWork = container.register(scriptUrl, { scope: appBaseUrl.href, type: 'module' });
    const registration = await this._registrationWork;
    this._registration = registration;
    this._lifetime.signal.throwIfAborted();
    signal?.throwIfAborted();
    if (registration.active?.state === 'activated' && container.controller === registration.active) return;
    await new Promise<void>((resolve, reject) => {
      const workers = [registration.installing, registration.waiting, registration.active].filter(worker => !!worker);
      const _onStateChanged = () => {
        const aborted = this._lifetime.signal.aborted ? this._lifetime.signal : signal;
        const controlled = registration.active?.state === 'activated' && container.controller === registration.active;
        const failed = workers.length > 0 && workers.every(worker => worker.state === 'redundant');
        if (!aborted?.aborted && !controlled && !failed) return;
        this._lifetime.signal.removeEventListener('abort', _onStateChanged);
        signal?.removeEventListener('abort', _onStateChanged);
        container.removeEventListener('controllerchange', _onStateChanged);
        for (const worker of workers) worker.removeEventListener('statechange', _onStateChanged);
        if (aborted?.aborted) reject(aborted.reason);
        else if (controlled) resolve();
        else reject(new Error('The stored-file service worker failed to activate.'));
      };
      this._lifetime.signal.addEventListener('abort', _onStateChanged, { once: true });
      signal?.addEventListener('abort', _onStateChanged, { once: true });
      container.addEventListener('controllerchange', _onStateChanged);
      for (const worker of workers) worker.addEventListener('statechange', _onStateChanged);
      _onStateChanged();
    });
  }
  async dispose() {
    this._lifetime.abort(new Error('The stored-worker loader was disposed.'));
    let registration = this._registration;
    try { registration = await this._registrationWork ?? registration; } catch { /* A rejected native registration acquired no new resource. */ }
    if (!registration) return;
    await registration.unregister();
    this._registration = undefined;
    this._registrationWork = undefined;
  }
  async respond(request: Request, appBaseUrl: URL) {
    const headers = { 'Cache-Control': 'no-store' };
    if (request.method !== 'GET') return new Response('Method not allowed.', { status: 405, headers: { ...headers, Allow: 'GET' } });
    let root: string, path: string;
    try {
      const url = new URL(request.url);
      if (!this.isStoredUrl(url, appBaseUrl)) return new Response('File not found.', { status: 404, headers });
      const prefix = new URL(this._config.rootPath + '/', appBaseUrl).pathname;
      const parts = url.pathname.slice(prefix.length).split('/').map(part => {
        const decoded = decodeURIComponent(part);
        if (decoded.includes('/') || decoded.includes('\\')) throw new Error('Encoded path separator.');
        return decoded;
      });
      root = this._config.rootPath + '/' + parts.shift();
      path = parts.join('/');
      _validatePath(root);
      _validatePath(path);
    } catch { return new Response('Invalid stored file path.', { status: 400, headers }); }
    try {
      const database = await this._openDatabase();
      let data: Uint8Array<ArrayBuffer> | undefined;
      try { data = await this._runTransaction(database, 'readonly', store => store.get([root, path])); }
      finally { database.close(); }
      if (!data) return new Response('File not found.', { status: 404, headers });
      return new Response(data, { headers: { ...headers, 'Content-Type': _mimeType(path) } });
    } catch { return new Response('File storage failed.', { status: 500, headers }); }
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
