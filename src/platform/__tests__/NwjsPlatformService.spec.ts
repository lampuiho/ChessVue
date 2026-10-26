import { describe, expect, it, vi } from 'vitest';
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

  it.each([false, true])('awaits checkpoints and native exit before shutdown (App.quit=%s)', async (appQuit) => {
    const platform = getPlatformService();
    const environment = getEnvironment();
    const process = await platform.getProcessManager(EngineClientType.Uci).spawnProcess('stockfish.exe');
    const quit = vi.fn();
    if (appQuit) environment.nw.App = { quit };
    let release!: () => void;
    const checkpoint = new Promise<void>(resolve => { release = resolve; });
    let checkpoints = 0;
    platform.subscribeToAppCloseRequested('saved-games', async () => { checkpoints += 1; await checkpoint; });
    environment.nwWindow.emit('close');
    environment.nwWindow.emit('close');
    await Promise.resolve();
    expect(checkpoints).toBe(1);
    expect(environment.nwWindow.closeCalls).toEqual([]);
    platform.getProcessManager(EngineClientType.Uci).assertProcessOpen(process);
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(environment.nwWindow.closeCalls).toEqual(appQuit ? [] : [true]);
    expect(quit).toHaveBeenCalledTimes(appQuit ? 1 : 0);
    expect(() => platform.getProcessManager(EngineClientType.Uci).assertProcessOpen(process)).toThrow();
  });
  it('finishes the remaining cleanup and exits after a checkpoint or process stop fails', async () => {
    const platform = getPlatformService();
    const environment = getEnvironment();
    const manager = platform.getProcessManager(EngineClientType.Uci);
    await manager.spawnProcess('first.exe');
    const failed = environment.latestProcess();
    await manager.spawnProcess('second.exe');
    const remaining = environment.latestProcess();
    vi.spyOn(failed, 'kill').mockReturnValue(false);
    const stopRemaining = vi.spyOn(remaining, 'kill').mockReturnValue(true);
    const quit = vi.fn();
    environment.nw.App = { quit };
    platform.subscribeToAppCloseRequested('saved-games', () => { throw new Error('Save failed.'); });
    environment.nwWindow.emit('close');
    environment.nwWindow.emit('close');
    await vi.waitFor(() => expect(stopRemaining).toHaveBeenCalledOnce());
    expect(quit).not.toHaveBeenCalled();
    remaining.emit('exit', 0, null);
    await vi.waitFor(() => expect(quit).toHaveBeenCalledOnce());
    failed.emit('exit', 0, null);
  });
  it('detaches native window event listeners with the owning store scope', async () => {
    const platform = getPlatformService();
    const environment = getEnvironment();
    let focusCalls = 0;
    platform.subscribeToAppFocusReturned('game', () => { focusCalls += 1; });
    platform.subscribeToAppCloseRequested('saved-games', () => {});
    platform.subscribeToSystemThemeChanged('settings', () => {});
    expect(environment.nwWindow.listenerCount('focus')).toBe(1);
    expect(environment.nwWindow.listenerCount('close')).toBe(1);
    platform.$dispose();
    expect(environment.nwWindow.listenerCount('focus')).toBe(0);
    expect(environment.nwWindow.listenerCount('close')).toBe(0);
    expect(platform.getEventRegistrationSnapshot()).toEqual([]);
    environment.nwWindow.emit('focus');
    expect(focusCalls).toBe(0);
  });
});
