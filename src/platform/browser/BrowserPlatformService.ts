import { defineStore } from 'pinia';
import { markRaw, onScopeDispose } from 'vue';
import { PlatformErrorKind, ResolvedThemeMode, type IPlatformError } from '@/contracts';
import { EngineClientType, PlatformEventKey, type IEngineClient, type IPlatformEventRegistration, type IPlatformService, type IProcessManager } from '@/contracts/platform';
import { RegistrationTimestamp } from '@/utility/date';
import { BrowserUciEngineClient } from './BrowserEngineClient';
import { BrowserProcessManager } from './BrowserProcessManager';
import { defineBrowserStorageAdapterStore } from './BrowserStorageAdapter';
import { BrowserSystemThemeAdapter } from './BrowserSystemThemeAdapter';

interface IEventRegistration<TCallback> {
  registration: IPlatformEventRegistration;
  callback: TCallback;
}
interface IBrowserPlatformOptions {
  storage?: Storage;
  storageKey?: string;
  createEngineServices?: () => { processManager: IProcessManager; engineClient: IEngineClient };
}
let _options: IBrowserPlatformOptions = {};
/** Set only at bootstrap, before creating platform stores (used by isolated journeys). */
export function setBrowserPlatformOptions(options: IBrowserPlatformOptions = {}) {
  _options = options;
}
export const useBrowserPlatformService = defineStore('platformService', () => {
  const storageAdapter = defineBrowserStorageAdapterStore(_options.storage, _options.storageKey)();
  const browserProcessManager = markRaw(new BrowserProcessManager());
  const bindings = new Map<EngineClientType, { processManager: IProcessManager; engineClient: IEngineClient }>([
    [EngineClientType.UciWorker, { processManager: browserProcessManager, engineClient: markRaw(new BrowserUciEngineClient()) }],
  ]);
  if (_options.createEngineServices) bindings.set(EngineClientType.Uci, _options.createEngineServices());
  const systemThemeAdapter = new BrowserSystemThemeAdapter();
  const closeRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
  const focusRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
  const themeRegistrations: IEventRegistration<(theme: ResolvedThemeMode) => void>[] = [];
  let nextRegistrationId = 1;
  let _themeMediaQuery: MediaQueryList | undefined;
  function _register<TCallback>(entries: IEventRegistration<TCallback>[], eventKey: PlatformEventKey, owner: string, callback: TCallback, debugLabel?: string): () => void {
    const registrationId = `platform-registration-${nextRegistrationId++}`;
    const entry = { registration: { registrationId, eventKey, owner, debugLabel, registeredAtUtc: new RegistrationTimestamp() }, callback };
    entries.push(entry);
    return () => {
      const index = entries.indexOf(entry);
      if (index >= 0) entries.splice(index, 1);
    };
  }
  async function _dispatch(entries: IEventRegistration<() => Promise<void> | void>[], operation: string): Promise<IPlatformError[]> {
    const failures: IPlatformError[] = [];
    for (const entry of [...entries]) {
      try {
        await entry.callback();
      } catch (error) {
        const failure = typeof error === 'object' && error !== null && 'kind' in error && 'message' in error ? error as IPlatformError : { kind: PlatformErrorKind.UnexpectedExit, message: error instanceof Error ? error.message : String(error) };
        failures.push({ ...failure, operation });
      }
    }
    return failures;
  }
  function _getEngineBinding(clientType: EngineClientType) {
    const binding = bindings.get(clientType);
    if (!binding) throw new Error('Unsupported engine client type: ' + String(clientType) + '.');
    return binding;
  }
  function getEngineClient(clientType: EngineClientType) { return _getEngineBinding(clientType).engineClient; }
  function getEventRegistrationSnapshot(): IPlatformEventRegistration[] {
    return [...closeRegistrations, ...focusRegistrations, ...themeRegistrations].map(({ registration }) => ({ ...registration, registeredAtUtc: new RegistrationTimestamp(registration.registeredAtUtc) })).sort((left, right) => left.registeredAtUtc.getTime() - right.registeredAtUtc.getTime() || left.registrationId.localeCompare(right.registrationId));
  }
  async function triggerAppCloseRequested(): Promise<IPlatformError[]> {
    return _dispatch(closeRegistrations, 'appCloseRequested');
  }
  async function triggerAppFocusReturned() {
    const failures = await _dispatch(focusRegistrations, 'appFocusReturned');
    for (const failure of failures) console.error('[browser] Focus callback failed.', failure);
  }
  function triggerSystemThemeChanged(theme: ResolvedThemeMode) {
    for (const entry of [...themeRegistrations]) entry.callback(theme);
  }
  function _checkpoint() {
    void triggerAppCloseRequested().then((failures) => {
      for (const failure of failures) console.error('[browser] Checkpoint failed.', failure);
    });
  }
  function _onFocus() { void triggerAppFocusReturned(); }
  function _onVisibility() {
    if (document.visibilityState === 'hidden') _checkpoint();
    else _onFocus();
  }
  function _onTheme(event: MediaQueryListEvent) {
    triggerSystemThemeChanged(event.matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light);
  }
  function subscribeToSystemThemeChanged(owner: string, callback: (theme: ResolvedThemeMode) => void, debugLabel?: string) {
    if (!_themeMediaQuery) {
      _themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      _themeMediaQuery.addEventListener('change', _onTheme);
    }
    return _register(themeRegistrations, PlatformEventKey.SystemThemeChanged, owner, callback, debugLabel);
  }
  function reset() {
    closeRegistrations.length = 0;
    focusRegistrations.length = 0;
    themeRegistrations.length = 0;
  }
  window.addEventListener('pagehide', _checkpoint);
  window.addEventListener('focus', _onFocus);
  document.addEventListener('visibilitychange', _onVisibility);
  onScopeDispose(() => {
    window.removeEventListener('pagehide', _checkpoint);
    window.removeEventListener('focus', _onFocus);
    document.removeEventListener('visibilitychange', _onVisibility);
    _themeMediaQuery?.removeEventListener('change', _onTheme);
    void browserProcessManager.dispose().catch(error => console.error('[browser] Worker process-manager cleanup failed.', error));
    reset();
  });
  const platformService = {
    getStorageAdapter: () => storageAdapter,
    getProcessManager: (clientType: EngineClientType) => _getEngineBinding(clientType).processManager,
    getSystemThemeAdapter: () => systemThemeAdapter,
    getEngineClient, getEventRegistrationSnapshot,
    subscribeToAppCloseRequested: (owner, callback, debugLabel?: string) => _register(closeRegistrations, PlatformEventKey.AppCloseRequested, owner, callback, debugLabel),
    subscribeToAppFocusReturned: (owner, callback, debugLabel?: string) => _register(focusRegistrations, PlatformEventKey.AppFocusReturned, owner, callback, debugLabel),
    subscribeToSystemThemeChanged,
  } satisfies IPlatformService;
  return { ...platformService, triggerAppCloseRequested, triggerAppFocusReturned, triggerSystemThemeChanged, reset };
});
