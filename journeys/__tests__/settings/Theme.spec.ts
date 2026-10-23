import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { ThemeMode, type IGame, type ISettingsSnapshot } from '@/contracts';
import { PlatformEventKey } from '@/contracts/platform';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { Deferred } from '@/utility/async/Deferred';
import { boot, clickButton, forgetRunning } from '../support/UiHarness';
async function _clickSettingsAction(label: string) {
  await nextTick();
  await clickButton(label, '.settings-actions button');
}
describe('JRN-SETTINGS-02 CSS theme ownership', () => {
  it('updates document appearance from UI acceptance without publishing drafts', async () => {
    const { stores, router } = await boot('settings');
    await router.push('/settings/appearance');
    const settings = stores.useSettingsStore();
    const root = document.documentElement;
    expect(root.dataset.themeMode).toBe(ThemeMode.Dark);
    settings.draftSettings!.appearance.themeMode = ThemeMode.Light;
    settings.draftSettings!.appearance.uiScalePercent = 125;
    expect(root.dataset.themeMode).toBe(ThemeMode.Dark);
    expect(root.style.getPropertyValue('--root-font-size-browser')).toBe('100%');
    await _clickSettingsAction('Apply changes');
    expect(root.dataset.themeMode).toBe(ThemeMode.Light);
    expect(root.style.getPropertyValue('--root-font-size-browser')).toBe('125%');
    expect(root.style.getPropertyValue('--root-font-size-landscape')).toBe('2.5vh');
    expect(root.style.getPropertyValue('--root-font-size-portrait')).toBe('2.5vw');
    expect(root.style.getPropertyValue('--theme-light-surface-app')).toBe(defaultLightThemeProfile.cssVariables['--surface-app']);
    expect(root.style.getPropertyValue('--theme-dark-surface-app')).toBe(defaultDarkThemeProfile.cssVariables['--surface-app']);
    settings.draftSettings!.appearance.themeMode = ThemeMode.System;
    await _clickSettingsAction('Save');
    expect(root.dataset.themeMode).toBe(ThemeMode.System);
    await router.push('/settings/appearance');
    await clickButton('Reset to defaults', '[aria-label="Reset to defaults"]');
    await clickButton('Reset settings', '[role="dialog"] button');
    expect(root.style.getPropertyValue('--root-font-size-browser')).toBe('100%');
    expect(root.dataset.themeMode).toBe(ThemeMode.System);
  });
  it('does not query or subscribe to the system theme across routes or disposal', async () => {
    const { router, app, games } = await boot('settings');
    const { usePlatformService } = await import('@/platform');
    const platform = usePlatformService();
    const _registrations = () => platform.getEventRegistrationSnapshot().filter((entry) => entry.eventKey === PlatformEventKey.SystemThemeChanged);
    const initial = _registrations();
    expect(initial).toEqual([]);
    expect(window.matchMedia).not.toHaveBeenCalled();
    for (let visit = 0; visit < 3; visit++) {
      await router.push('/game/settings-game');
      await router.push('/settings/appearance');
      expect(_registrations()).toEqual(initial);
    }
    for (const game of games.listGames()) await games.stopAnalysis(game as unknown as IGame);
    app.unmount();
    router.options.history.destroy();
    forgetRunning();
    expect(_registrations()).toEqual([]);
    expect(window.matchMedia).not.toHaveBeenCalled();
  });
  it('keeps document appearance unchanged when applying settings fails', async () => {
    const { stores, domain, router } = await boot('settings');
    await router.push('/settings/appearance');
    const settings = stores.useSettingsStore();
    settings.draftSettings!.appearance.themeMode = ThemeMode.Light;
    settings.draftSettings!.appearance.uiScalePercent = 125;
    vi.spyOn(domain.UserSettingService, 'saveSettings').mockRejectedValueOnce(new Error('Write failed'));
    await _clickSettingsAction('Apply changes');
    expect(document.querySelector('.settings-feedback--error')?.textContent).toBe('Write failed');
    expect(document.documentElement.dataset.themeMode).toBe(ThemeMode.Dark);
    expect(document.documentElement.style.getPropertyValue('--root-font-size-browser')).toBe('100%');
  });
  it('does not update the document after an in-flight settings action outlives App', async () => {
    const { stores, domain, app, router, games } = await boot('settings');
    await router.push('/settings/appearance');
    const settings = stores.useSettingsStore();
    const accepted = JSON.parse(JSON.stringify(settings.settings)) as ISettingsSnapshot;
    accepted.appearance.uiScalePercent = 125;
    const pending = new Deferred<ISettingsSnapshot>();
    const save = vi.spyOn(domain.UserSettingService, 'saveSettings').mockReturnValueOnce(pending);
    settings.draftSettings!.appearance.uiScalePercent = 125;
    await _clickSettingsAction('Apply changes');
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    for (const game of games.listGames()) await games.stopAnalysis(game as unknown as IGame);
    app.unmount();
    router.options.history.destroy();
    forgetRunning();
    pending.resolve(accepted);
    await flushPromises();
    expect(document.documentElement.style.getPropertyValue('--root-font-size-browser')).toBe('100%');
  });
});
