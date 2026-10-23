import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, isReadonly, nextTick, toRaw } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeMode, type ISettingsSnapshot } from '@/contracts';
import { createSettingsSnapshot, resolveWithRandomDelay } from './StateStoreTestUtility';
let useSettingsStore: typeof import('..').useSettingsStore;
let settingsSnapshot: ISettingsSnapshot;
const domain = {
  PlatformEventService: { subscribeToSystemThemeChanged: vi.fn() },
  UserSettingService: {
    getLoadWarning: vi.fn(() => ''),
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
    getSystemTheme: vi.fn(),
    saveSettings: vi.fn(async (snapshot: ISettingsSnapshot) => {
      settingsSnapshot = JSON.parse(JSON.stringify(snapshot)) as ISettingsSnapshot;
      return resolveWithRandomDelay(settingsSnapshot);
    }),
    resetSettings: vi.fn(async () => {
      settingsSnapshot = createSettingsSnapshot();
      return resolveWithRandomDelay(settingsSnapshot);
    }),
  },
};
describe('useSettingsStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    settingsSnapshot = createSettingsSnapshot();
    vi.clearAllMocks();
    vi.doMock('@/domain', () => domain);
    ({ useSettingsStore } = await import('..'));
  });
  it('projects the accepted policy and both configured palettes while edits stay in the draft', async () => {
    const store = useSettingsStore();
    await store.loadSettings();
    expect(store.settings?.analysis.engineInventory).toHaveLength(2);
    expect(isReadonly(store.settings)).toBe(true);
    expect(store.draftSettings).not.toBe(store.settings);
    const { defaultDarkThemeProfile, defaultLightThemeProfile } = await import('@/config/AppearanceConfig');
    expect(toRaw(store.appearanceProjection!.lightThemeProfile)).toBe(defaultLightThemeProfile);
    expect(toRaw(store.appearanceProjection!.darkThemeProfile)).toBe(defaultDarkThemeProfile);
    expect(store.appearanceProjection?.themeMode).toBe(ThemeMode.System);
    store.draftSettings!.appearance.themeMode = ThemeMode.Dark;
    expect(store.hasPendingChanges).toBe(true);
    expect(store.appearanceProjection?.themeMode).toBe(ThemeMode.System);
    await store.applySettings();
    expect(store.appearanceProjection?.themeMode).toBe(ThemeMode.Dark);
    expect(store.hasPendingChanges).toBe(false);
    expect(store.draftSettings).not.toBe(store.settings);
    store.discardPendingSettings();
    expect(store.draftSettings?.appearance.themeMode).toBe(ThemeMode.Dark);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
  });
  it('saves and resets accepted settings through the domain service', async () => {
    const store = useSettingsStore();
    await store.loadSettings();
    store.updateSettings({ appearance: { themeMode: ThemeMode.Light } as ISettingsSnapshot['appearance'] });
    await store.saveSettings();
    expect(store.appearanceProjection?.themeMode).toBe(ThemeMode.Light);
    await store.resetSettings();
    expect(store.appearanceProjection?.themeMode).toBe(ThemeMode.System);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
    expect(domain.UserSettingService.resetSettings).toHaveBeenCalledTimes(1);
  });
  it('rerenders draft, dirty and accepted theme policy', async () => {
    const store = useSettingsStore();
    await store.loadSettings();
    const wrapper = mount(defineComponent({ setup: () => () => h('div', [
      h('span', { class: 'accepted-theme' }, store.appearanceProjection?.themeMode ?? 'loading'),
      h('span', { class: 'draft-theme' }, store.draftSettings?.appearance.themeMode ?? 'loading'),
      h('span', { class: 'dirty' }, String(store.hasPendingChanges)),
    ]) }));
    store.draftSettings!.appearance.themeMode = ThemeMode.Dark;
    await nextTick();
    expect(wrapper.get('.draft-theme').text()).toBe(ThemeMode.Dark);
    expect(wrapper.get('.accepted-theme').text()).toBe(ThemeMode.System);
    expect(wrapper.get('.dirty').text()).toBe('true');
    await store.applySettings();
    await nextTick();
    expect(wrapper.get('.accepted-theme').text()).toBe(ThemeMode.Dark);
    expect(wrapper.get('.dirty').text()).toBe('false');
    store.draftSettings!.appearance.themeMode = ThemeMode.System;
    await store.applySettings();
    await nextTick();
    expect(wrapper.get('.accepted-theme').text()).toBe(ThemeMode.System);
    wrapper.unmount();
  });
  it('retains accepted settings and the edited draft when persistence fails', async () => {
    const store = useSettingsStore();
    await store.loadSettings();
    store.draftSettings!.appearance.themeMode = ThemeMode.Dark;
    domain.UserSettingService.saveSettings.mockRejectedValueOnce(new Error('Write failed'));
    await expect(store.applySettings()).rejects.toThrow('Write failed');
    expect(store.settings?.appearance.themeMode).toBe(ThemeMode.System);
    expect(store.draftSettings?.appearance.themeMode).toBe(ThemeMode.Dark);
    expect(store.hasPendingChanges).toBe(true);
  });
  it('loads once without querying or subscribing to the host theme', async () => {
    const store = useSettingsStore();
    await Promise.all([store.loadSettings(), store.loadSettings()]);
    store.$dispose();
    expect(domain.UserSettingService.getSettingsOrDefault).toHaveBeenCalledTimes(1);
    expect(domain.UserSettingService.getSystemTheme).not.toHaveBeenCalled();
    expect(domain.PlatformEventService.subscribeToSystemThemeChanged).not.toHaveBeenCalled();
  });
});
