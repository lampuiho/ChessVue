import { describe, expect, it } from 'vitest';
import { isProxy } from 'vue';
import { EngineClientType } from '@/contracts/platform';

import { registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('usePlatformService', () => {
  it('exposes platform services through the platform store', async () => {
    const { NwjsUciEngineClient } = await import('../nwjs/NwjsUciEngineClient');
    const platform = getPlatformService();

    expect(typeof platform.getStorageAdapter).toBe('function');
    expect(typeof platform.getProcessManager).toBe('function');
    expect(typeof platform.getSystemThemeAdapter).toBe('function');
    expect(typeof platform.getEngineClient).toBe('function');
    const client = platform.getEngineClient(EngineClientType.Uci);
    expect(client).toBeInstanceOf(NwjsUciEngineClient);
    expect(isProxy(client)).toBe(false);
    expect(platform.getEngineClient(EngineClientType.Uci)).toBe(client);
    expect(platform.getEventRegistrationSnapshot()).toEqual([]);
  });
  it('tracks app event registrations from the injected nw window and theme listener', async () => {
    const platform = getPlatformService();
    const environment = getEnvironment();
    const callbackOrder: string[] = [];
    const unsubscribeTheme = platform.subscribeToSystemThemeChanged('settings', (theme) => {
      callbackOrder.push(`theme:${theme}`);
    }, 'appearance');

    platform.subscribeToAppCloseRequested('games', () => {
      callbackOrder.push('close:first');
    }, 'autosave');
    platform.subscribeToAppCloseRequested('games', () => {
      callbackOrder.push('close:second');
      throw new Error('close failed');
    }, 'telemetry');
    platform.subscribeToAppFocusReturned('games', () => {
      callbackOrder.push('focus');
    }, 'resume');
    expect(platform.getEventRegistrationSnapshot()).toHaveLength(4);

    environment.nwWindow.emit('focus');
    environment.mediaQuery.setMatches(true);
    environment.nwWindow.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribeTheme();

    expect(callbackOrder).toContain('focus');
    expect(callbackOrder).toContain('theme:dark');
    expect(callbackOrder).toContain('close:first');
    expect(environment.nwWindow.closeCalls).toContain(true);
    expect(platform.getEventRegistrationSnapshot()).toHaveLength(3);
  });
});
