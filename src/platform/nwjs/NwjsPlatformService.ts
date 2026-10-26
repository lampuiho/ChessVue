import { defineStore } from 'pinia';
import { markRaw, onScopeDispose } from 'vue';

import { ResolvedThemeMode, PlatformErrorKind, type IPlatformError } from '@/contracts';
import { EngineClientType, PlatformEventKey, type IPlatformEventRegistration, type IPlatformService } from '@/contracts/platform';
import type { INwjsGlobal } from '@/utility/nwjs/NwjsUtility';
import { RegistrationTimestamp } from '@/utility/date';
import { NwjsProcessManager } from './NwjsProcessManager';
import { defineNwjsStorageAdapterStore } from './NwjsStorageAdapter';
import { defineNwjsSystemThemeAdapterStore } from './NwjsSystemThemeAdapter';
import { NwjsUciEngineClient } from './NwjsUciEngineClient';
import { BrowserUciEngineClient } from '../browser/BrowserEngineClient';
import type { IProcessManager, IEngineClient } from '@/contracts/platform';

interface IEventRegistration<TCallback> {
  registration: IPlatformEventRegistration;
  callback: TCallback;
}

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export function defineNwjsPlatformServiceStore(nw: INwjsGlobal) {
  const useNwjsStorageAdapter = defineNwjsStorageAdapterStore(nw);
  const useNwjsSystemThemeAdapter = defineNwjsSystemThemeAdapterStore(nw);
  return defineStore('platformService', () => {
    let nextRegistrationId = 1;
    const storageAdapter = useNwjsStorageAdapter();
    const processManager = markRaw(new NwjsProcessManager(EngineClientType.Uci));
    const systemThemeAdapter = useNwjsSystemThemeAdapter();
    const workerProcessManager = markRaw(new NwjsProcessManager(EngineClientType.UciWorker));
    const bindings = new Map<EngineClientType, { processManager: IProcessManager; engineClient: IEngineClient }>([
      [EngineClientType.Uci, { processManager, engineClient: markRaw(new NwjsUciEngineClient()) }],
      [EngineClientType.UciWorker, { processManager: workerProcessManager, engineClient: markRaw(new BrowserUciEngineClient()) }],
    ]);
    const appCloseRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
    const appFocusRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
    const themeRegistrations: IEventRegistration<(theme: ResolvedThemeMode) => void>[] = [];
    let hasAttachedWindowClose = false;
    let hasAttachedWindowFocus = false;
    let hasAttachedThemeListener = false;
    const _windowCleanups: (() => void)[] = [];
    onScopeDispose(_dispose);

    function getStorageAdapter() {
      return storageAdapter;
    }
    function _getEngineBinding(clientType: EngineClientType) {
      const binding = bindings.get(clientType);
      if (!binding) throw new Error('Unsupported engine client type: ' + String(clientType) + '.');
      return binding;
    }
    function getProcessManager(clientType: EngineClientType) { return _getEngineBinding(clientType).processManager; }
    function getSystemThemeAdapter() {
      return systemThemeAdapter;
    }
    function getEngineClient(clientType: EngineClientType) { return _getEngineBinding(clientType).engineClient; }
    function subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void {
      _attachWindowCloseListener();
      return _registerCallback(appCloseRegistrations, PlatformEventKey.AppCloseRequested, owner, onCloseRequested, debugLabel);
    }
    function subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void {
      _attachWindowFocusListener();
      return _registerCallback(appFocusRegistrations, PlatformEventKey.AppFocusReturned, owner, onFocusReturned, debugLabel);
    }
    function subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void {
      _attachThemeListener();
      return _registerCallback(themeRegistrations, PlatformEventKey.SystemThemeChanged, owner, onChanged, debugLabel);
    }
    function getEventRegistrationSnapshot(): IPlatformEventRegistration[] {
      return [...appCloseRegistrations, ...appFocusRegistrations, ...themeRegistrations].map((entry) => ({ ...entry.registration })).sort((left, right) => left.registeredAtUtc.getTime() - right.registeredAtUtc.getTime() || left.registrationId.localeCompare(right.registrationId));
    }
    async function triggerAppCloseRequested(): Promise<IPlatformError[]> {
      const failures: IPlatformError[] = [];
      for (const entry of [...appCloseRegistrations]) {
        try {
          await entry.callback();
        } catch (error) {
          failures.push(_toPlatformError('appCloseRequested', error));
        }
      }
      return failures;
    }
    async function triggerAppFocusReturned() {
      for (const entry of [...appFocusRegistrations]) await entry.callback();
    }
    function triggerSystemThemeChanged(theme: ResolvedThemeMode) {
      for (const entry of [...themeRegistrations]) entry.callback(theme);
    }
    function reset() {
      nextRegistrationId = 1;
      appCloseRegistrations.length = 0;
      appFocusRegistrations.length = 0;
      themeRegistrations.length = 0;
    }
    async function _dispose() {
      for (const cleanup of _windowCleanups.splice(0)) cleanup();
      reset();
      await _disposeProcessManagers();
    }
    async function _disposeProcessManagers() {
      await Promise.allSettled([processManager.dispose(), workerProcessManager.dispose()]);
    }
    function _attachWindowCloseListener() {
      if (hasAttachedWindowClose) return;
      hasAttachedWindowClose = true;
      const nativeWindow = nw.Window.get(window);
      let closing = false;
      async function _close() {
        if (closing) return;
        closing = true;
        await triggerAppCloseRequested();
        await _disposeProcessManagers();
        if (nw.App) nw.App.quit();
        else nativeWindow.close(true);
      }
      nativeWindow.on('close', _close);
      _windowCleanups.push(() => nativeWindow.removeListener('close', _close));
    }
    function _attachWindowFocusListener() {
      if (hasAttachedWindowFocus) return;
      hasAttachedWindowFocus = true;
      const nativeWindow = nw.Window.get(window);
      const _focus = () => { void triggerAppFocusReturned(); };
      nativeWindow.on('focus', _focus);
      _windowCleanups.push(() => nativeWindow.removeListener('focus', _focus));
    }
    function _attachThemeListener() {
      if (hasAttachedThemeListener) return;
      hasAttachedThemeListener = true;
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const _changed = (event: MediaQueryListEvent) => {
        triggerSystemThemeChanged(event.matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light);
      };
      mediaQuery.addEventListener('change', _changed);
      _windowCleanups.push(() => mediaQuery.removeEventListener('change', _changed));
    }
    function _registerCallback<TCallback>(registrations: IEventRegistration<TCallback>[], eventKey: PlatformEventKey, owner: string, callback: TCallback, debugLabel?: string): () => void {
      const registrationId = `platform-registration-${nextRegistrationId++}`;
      const entry: IEventRegistration<TCallback> = { registration: { registrationId, eventKey, owner, debugLabel, registeredAtUtc: new RegistrationTimestamp() }, callback };
      registrations.push(entry);
      return () => {
        const index = registrations.findIndex((candidate) => candidate.registration.registrationId === registrationId);
        if (index >= 0) registrations.splice(index, 1);
      };
    }
    function _toPlatformError(operation: string, error: unknown): IPlatformError {
      if (typeof error === 'object' && error !== null && 'kind' in error && 'message' in error) return { ...(error as IPlatformError), operation };
      return _createPlatformError(PlatformErrorKind.UnexpectedExit, operation, error instanceof Error ? error.message : 'Unknown platform event failure.');
    }

    const platformService = { getStorageAdapter, getProcessManager, getSystemThemeAdapter, getEngineClient, subscribeToAppCloseRequested, subscribeToAppFocusReturned, subscribeToSystemThemeChanged, getEventRegistrationSnapshot } satisfies IPlatformService;
    return { ...platformService, triggerAppCloseRequested, triggerAppFocusReturned, triggerSystemThemeChanged, reset };
  });
}
