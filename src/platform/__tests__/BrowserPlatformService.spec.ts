import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineClientType, ResolvedThemeMode } from '@/contracts';
import { setBrowserPlatformOptions, useBrowserPlatformService } from '../browser/BrowserPlatformService';

let pinia: Pinia;
let themeChanged: (event: MediaQueryListEvent) => void;
const removeThemeListener = vi.fn();
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  setBrowserPlatformOptions({ storage: sessionStorage, storageKey: 'platform-test' });
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: true,
    addEventListener: (_name: string, listener: typeof themeChanged) => { themeChanged = listener; },
    removeEventListener: removeThemeListener,
  })));
});
afterEach(() => {
  disposePinia(pinia);
  setBrowserPlatformOptions();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('browser host services', () => {
  it('exposes UCI support while rejecting native executables through typed errors', async () => {
    const platform = useBrowserPlatformService();
    expect(platform.getSystemThemeAdapter().getSystemTheme()).toBe(ResolvedThemeMode.Dark);
    await expect(platform.getProcessManager().spawnProcess('stockfish.exe')).rejects.toMatchObject({ kind: 'processStartFailed', message: expect.stringContaining('desktop') });
    expect(() => platform.getProcessManager().assertProcessHandleOpen('missing')).toThrow();
    expect(typeof platform.getEngineClient(EngineClientType.Uci).startAnalysis).toBe('function');
  });
  it('dispatches focus/theme events, tracks copied registrations and unsubscribes', async () => {
    const platform = useBrowserPlatformService();
    const focus = vi.fn();
    const theme = vi.fn();
    const unsubscribe = platform.subscribeToAppFocusReturned('games', focus, 'clock');
    platform.subscribeToSystemThemeChanged('settings', theme);
    const snapshot = platform.getEventRegistrationSnapshot();
    snapshot[0]!.owner = 'changed';
    snapshot[0]!.registeredAtUtc.setTime(0);
    expect(platform.getEventRegistrationSnapshot()[0]!.owner).toBe('games');
    expect(platform.getEventRegistrationSnapshot()[0]!.registeredAtUtc.getTime()).toBeGreaterThan(0);
    window.dispatchEvent(new Event('focus'));
    themeChanged({ matches: false } as MediaQueryListEvent);
    await vi.waitFor(() => expect(focus).toHaveBeenCalledOnce());
    expect(theme).toHaveBeenCalledWith(ResolvedThemeMode.Light);
    unsubscribe();
    expect(platform.getEventRegistrationSnapshot()).toHaveLength(1);
  });
  it('awaits every checkpoint callback in order despite failures', async () => {
    const platform = useBrowserPlatformService();
    const calls: number[] = [];
    platform.subscribeToAppCloseRequested('first', async () => { await Promise.resolve(); calls.push(1); });
    platform.subscribeToAppCloseRequested('second', () => { calls.push(2); throw new Error('Failed'); });
    platform.subscribeToAppCloseRequested('third', () => { calls.push(3); });
    expect(await platform.triggerAppCloseRequested()).toMatchObject([{ kind: 'unexpectedExit', operation: 'appCloseRequested' }]);
    expect(calls).toEqual([1, 2, 3]);
  });
  it('checkpoints on page hide and removes listeners on disposal', async () => {
    const platform = useBrowserPlatformService();
    const checkpoint = vi.fn();
    platform.subscribeToAppCloseRequested('games', checkpoint);
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(checkpoint).toHaveBeenCalledOnce());
    disposePinia(pinia);
    window.dispatchEvent(new Event('pagehide'));
    expect(checkpoint).toHaveBeenCalledOnce();
    expect(removeThemeListener).toHaveBeenCalled();
  });
  it('checkpoints while hidden and refreshes on visibility return', async () => {
    const platform = useBrowserPlatformService();
    const checkpoint = vi.fn();
    const focus = vi.fn();
    platform.subscribeToAppCloseRequested('games', checkpoint);
    platform.subscribeToAppFocusReturned('games', focus);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(checkpoint).toHaveBeenCalledOnce());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(focus).toHaveBeenCalledOnce());
  });
});
