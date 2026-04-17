import { defineStore } from 'pinia';

import { ResolvedThemeMode, PlatformErrorKind, type IPlatformError } from '@/contracts';
import type { INwjsGlobal } from '@/utility/nwjs/NwjsUtility';

import { EngineClientType, PlatformEventKey, type IPlatformEventRegistration, type IPlatformService } from '../contracts';
import { defineNwjsProcessManagerStore } from './NwjsProcessManager';
import { createNwjsProcessRegistry } from './NwjsProcessRegistry';
import { defineNwjsStorageAdapterStore } from './NwjsStorageAdapter';
import { defineNwjsSystemThemeAdapterStore } from './NwjsSystemThemeAdapter';
import { defineNwjsUciEngineClientStore } from './NwjsUciEngineClient';

interface IEventRegistration<TCallback> {
  registration: IPlatformEventRegistration;
  callback: TCallback;
}

function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
export function defineNwjsPlatformServiceStore(nw: INwjsGlobal) {
  const processRegistry = createNwjsProcessRegistry();
  const useNwjsStorageAdapter = defineNwjsStorageAdapterStore(nw);
  const useNwjsProcessManager = defineNwjsProcessManagerStore(nw, processRegistry);
  const useNwjsSystemThemeAdapter = defineNwjsSystemThemeAdapterStore(nw);
  const useNwjsUciEngineClient = defineNwjsUciEngineClientStore(nw, processRegistry);
  return defineStore('platformService', () => {
    let nextRegistrationId = 1;
    const storageAdapter = useNwjsStorageAdapter();
    const processManager = useNwjsProcessManager();
    const systemThemeAdapter = useNwjsSystemThemeAdapter();
    const uciEngineClient = useNwjsUciEngineClient();
    const appCloseRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
    const appFocusRegistrations: IEventRegistration<() => Promise<void> | void>[] = [];
    const themeRegistrations: IEventRegistration<(theme: ResolvedThemeMode) => void>[] = [];
    let hasAttachedWindowClose = false;
    let hasAttachedWindowFocus = false;
    let hasAttachedThemeListener = false;

    function getStorageAdapter() {
      return storageAdapter;
    }
    function getProcessManager() {
      return processManager;
    }
    function getSystemThemeAdapter() {
      return systemThemeAdapter;
    }
    function getEngineClient(engineClientType: EngineClientType) {
      switch (engineClientType) {
        case EngineClientType.Uci: return uciEngineClient;
        default: throw new Error(`Unsupported engine client type: ${String(engineClientType)}.`);
      }
    }
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
      return [...appCloseRegistrations, ...appFocusRegistrations, ...themeRegistrations].map((entry) => ({ ...entry.registration })).sort((left, right) => left.registeredAtUtc.localeCompare(right.registeredAtUtc) || left.registrationId.localeCompare(right.registrationId));
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
    async function triggerAppFocusReturned(): Promise<void> {
      for (const entry of [...appFocusRegistrations]) await entry.callback();
    }
    function triggerSystemThemeChanged(theme: ResolvedThemeMode): void {
      for (const entry of [...themeRegistrations]) entry.callback(theme);
    }
    function reset(): void {
      nextRegistrationId = 1;
      appCloseRegistrations.length = 0;
      appFocusRegistrations.length = 0;
      themeRegistrations.length = 0;
    }
    function _attachWindowCloseListener(): void {
      if (hasAttachedWindowClose) return;
      hasAttachedWindowClose = true;
      nw.Window.get(window).on('close', async () => {
        await triggerAppCloseRequested();
        nw.Window.get(window).close(true);
      });
    }
    function _attachWindowFocusListener(): void {
      if (hasAttachedWindowFocus) return;
      hasAttachedWindowFocus = true;
      nw.Window.get(window).on('focus', () => {
        void triggerAppFocusReturned();
      });
    }
    function _attachThemeListener(): void {
      if (hasAttachedThemeListener) return;
      hasAttachedThemeListener = true;
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (event) => {
        triggerSystemThemeChanged(event.matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light);
      });
    }
    function _registerCallback<TCallback>(registrations: IEventRegistration<TCallback>[], eventKey: PlatformEventKey, owner: string, callback: TCallback, debugLabel?: string): () => void {
      const registrationId = `platform-registration-${nextRegistrationId++}`;
      const entry: IEventRegistration<TCallback> = { registration: { registrationId, eventKey, owner, debugLabel, registeredAtUtc: new Date().toISOString() }, callback };
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
