import { defineStore } from 'pinia';
import { onScopeDispose } from 'vue';
import { PlatformErrorKind, ResolvedThemeMode, type IPlatformError } from '@/contracts';
import { EngineClientType, PlatformEventKey, type IEngineClient, type IPlatformEventRegistration, type IPlatformService, type IProcessManager } from '@/contracts/platform';
import { RegistrationTimestamp } from '@/utility/date';
import { defineBrowserUciEngineClientStore } from './BrowserEngineClient';
import { BrowserProcessManager, type BrowserEngineRegistry } from './BrowserProcessManager';
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
export function setBrowserPlatformOptions(options: IBrowserPlatformOptions = {}): void {
  _options = options;
}
export const useBrowserPlatformService = defineStore('platformService', () => {
  const storageAdapter = defineBrowserStorageAdapterStore(_options.storage, _options.storageKey)();
  const registry: BrowserEngineRegistry = new Map();
  const browserProcessManager = new BrowserProcessManager(registry);
  const { processManager, engineClient } = _options.createEngineServices?.() ?? { processManager: browserProcessManager, engineClient: defineBrowserUciEngineClientStore(registry)() };
  const systemThemeAdapter = new BrowserSystemThemeAdapter();
  const closeRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
  const focusRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
  const themeRegistrations: IEventRegistration<(theme: ResolvedThemeMode) => void>[] = [];
  let nextRegistrationId = 1;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
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
  function getEngineClient(clientType: EngineClientType): IEngineClient {
    if (clientType !== EngineClientType.Uci) throw new Error(`Unsupported engine client type: ${String(clientType)}.`);
    return engineClient;
  }
  function getEventRegistrationSnapshot(): IPlatformEventRegistration[] {
    return [...closeRegistrations, ...focusRegistrations, ...themeRegistrations].map(({ registration }) => ({ ...registration, registeredAtUtc: new RegistrationTimestamp(registration.registeredAtUtc) })).sort((left, right) => left.registeredAtUtc.getTime() - right.registeredAtUtc.getTime() || left.registrationId.localeCompare(right.registrationId));
  }
  async function triggerAppCloseRequested(): Promise<IPlatformError[]> {
    return _dispatch(closeRegistrations, 'appCloseRequested');
  }
  async function triggerAppFocusReturned(): Promise<void> {
    const failures = await _dispatch(focusRegistrations, 'appFocusReturned');
    for (const failure of failures) console.error('[browser] Focus callback failed.', failure);
  }
  function triggerSystemThemeChanged(theme: ResolvedThemeMode): void {
    for (const entry of [...themeRegistrations]) entry.callback(theme);
  }
  function _checkpoint(): void {
    void triggerAppCloseRequested().then((failures) => {
      for (const failure of failures) console.error('[browser] Checkpoint failed.', failure);
    });
  }
  function _onFocus(): void { void triggerAppFocusReturned(); }
  function _onVisibility(): void {
    if (document.visibilityState === 'hidden') _checkpoint();
    else _onFocus();
  }
  function _onTheme(event: MediaQueryListEvent): void {
    triggerSystemThemeChanged(event.matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light);
  }
  function reset(): void {
    closeRegistrations.length = 0;
    focusRegistrations.length = 0;
    themeRegistrations.length = 0;
  }
  window.addEventListener('pagehide', _checkpoint);
  window.addEventListener('focus', _onFocus);
  document.addEventListener('visibilitychange', _onVisibility);
  mediaQuery.addEventListener('change', _onTheme);
  onScopeDispose(() => {
    window.removeEventListener('pagehide', _checkpoint);
    window.removeEventListener('focus', _onFocus);
    document.removeEventListener('visibilitychange', _onVisibility);
    mediaQuery.removeEventListener('change', _onTheme);
    browserProcessManager.dispose();
    reset();
  });
  const platformService = {
    getStorageAdapter: () => storageAdapter,
    getProcessManager: () => processManager,
    getSystemThemeAdapter: () => systemThemeAdapter,
    getEngineClient, getEventRegistrationSnapshot,
    subscribeToAppCloseRequested: (owner, callback, debugLabel?: string) => _register(closeRegistrations, PlatformEventKey.AppCloseRequested, owner, callback, debugLabel),
    subscribeToAppFocusReturned: (owner, callback, debugLabel?: string) => _register(focusRegistrations, PlatformEventKey.AppFocusReturned, owner, callback, debugLabel),
    subscribeToSystemThemeChanged: (owner, callback, debugLabel?: string) => _register(themeRegistrations, PlatformEventKey.SystemThemeChanged, owner, callback, debugLabel),
  } satisfies IPlatformService;
  return { ...platformService, triggerAppCloseRequested, triggerAppFocusReturned, triggerSystemThemeChanged, reset };
});
