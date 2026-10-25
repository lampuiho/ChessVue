import { StoredWorkerUtility, type IStoredWorkerConfig } from './StoredWorkerUtility';

interface IStoredWorkerActivateEvent { waitUntil(work: Promise<unknown>): void; }
interface IStoredWorkerFetchEvent { request: Request; respondWith(response: Promise<Response>): void; }
export interface IStoredWorkerScope {
  location: { href: string };
  registration: { scope: string };
  clients: { claim(): Promise<void> };
  addEventListener(event: 'activate', listener: (event: IStoredWorkerActivateEvent) => void): void;
  addEventListener(event: 'fetch', listener: (event: IStoredWorkerFetchEvent) => void): void;
  removeEventListener(event: 'activate', listener: (event: IStoredWorkerActivateEvent) => void): void;
  removeEventListener(event: 'fetch', listener: (event: IStoredWorkerFetchEvent) => void): void;
}
export class StoredWorkerServer {
  private readonly _storedFiles: StoredWorkerUtility;
  private readonly _appBaseUrl: URL;
  private _started = false;
  private readonly _onActivate = (event: IStoredWorkerActivateEvent) => { event.waitUntil(this._scope.clients.claim()); };
  private readonly _onFetch = (event: IStoredWorkerFetchEvent) => {
    if (this._storedFiles.isStoredUrl(new URL(event.request.url), this._appBaseUrl)) event.respondWith(this._storedFiles.respond(event.request, this._appBaseUrl));
  };
  constructor(config: IStoredWorkerConfig, private readonly _scope: IStoredWorkerScope) {
    this._storedFiles = new StoredWorkerUtility(config);
    this._appBaseUrl = new URL(_scope.registration.scope);
  }
  start() {
    if (this._started) return;
    this._started = true;
    this._scope.addEventListener('activate', this._onActivate);
    this._scope.addEventListener('fetch', this._onFetch);
  }
  dispose() {
    if (!this._started) return;
    this._started = false;
    this._scope.removeEventListener('activate', this._onActivate);
    this._scope.removeEventListener('fetch', this._onFetch);
  }
}
