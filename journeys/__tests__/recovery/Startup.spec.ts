import { describe, expect, it, vi } from 'vitest';
import { boot, clickButton, findButton, forgetRunning } from '../support/UiHarness';
describe('UI-13 startup recovery', () => {
  it('chooses the first valid restored game and provides recovery actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { router } = await boot('recovery');
    expect(router.currentRoute.value.path).toBe('/game/recovery-valid');
    expect(document.querySelector('.recovery-notice')?.textContent).toContain('Settings could not be read');
    expect(findButton('Saved games', '.recovery-notice button')).toBeDefined();
    await clickButton('Dismiss', '.recovery-notice button');
    expect(document.querySelector('.recovery-notice')).toBeNull();
  });
  it('ignores the remembered route when restore-session is disabled', async () => {
    const { stores, app, router, stopReady } = await boot('settings');
    const settings = stores.useSettingsStore();
    settings.draftSettings!.gameSession.restorePreviousSession = false;
    await settings.applySettings();
    stores.useUiStateStore().setActiveRoute('/settings/appearance');
    await stores.useUiStateStore().saveGameSession();
    stopReady();
    app.unmount();
    router.options.history.destroy();
    forgetRunning();
    vi.resetModules();
    const restarted = await boot('settings');
    expect(restarted.router.currentRoute.value.path).toBe('/home');
    expect(restarted.games.listGames()).toHaveLength(0);
  });
});
