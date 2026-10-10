import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, isReadonly, nextTick, toRaw } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResolvedThemeMode, ThemeMode, type ISettingsSnapshot } from '@/contracts';

import { createSettingsSnapshot, resolveWithRandomDelay } from './StateStoreTestUtility';

let useSettingsStore: typeof import('..').useSettingsStore;
let settingsSnapshot: ISettingsSnapshot;
let systemTheme = ResolvedThemeMode.Light;
let themeChangedHandler: ((theme: ResolvedThemeMode) => void) | undefined;
let disposeThemeSubscription: () => void;
const domain = {
  PlatformEventService: {
    subscribeToSystemThemeChanged: vi.fn((_owner: string, onChanged: (theme: ResolvedThemeMode) => void) => {
      themeChangedHandler = onChanged;
      return () => {
        disposeThemeSubscription();
        if (themeChangedHandler === onChanged) themeChangedHandler = undefined;
      };
    }),
  },
  UserSettingService: {
    getLoadWarning: vi.fn(() => ''),
    getSettings: vi.fn(() => structuredClone(settingsSnapshot)),
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
    getSystemTheme: vi.fn(() => systemTheme),
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
    systemTheme = ResolvedThemeMode.Light;
    themeChangedHandler = undefined;
    disposeThemeSubscription = vi.fn();
    domain.PlatformEventService.subscribeToSystemThemeChanged.mockClear();
    domain.UserSettingService.getSettings.mockClear();
    domain.UserSettingService.getSettingsOrDefault.mockClear();
    domain.UserSettingService.getSystemTheme.mockClear();
    domain.UserSettingService.saveSettings.mockClear();
    domain.UserSettingService.resetSettings.mockClear();
    vi.doMock('@/domain', () => domain);
    ({ useSettingsStore } = await import('..'));
  });

  it('manages draft settings and applies accepted settings to the appearance projection', async () => {
    const store = useSettingsStore();
    await store.loadSettings();

    expect(store.settings?.analysis.engineInventory).toHaveLength(2);
    expect(isReadonly(store.settings)).toBe(true);
    expect(store.draftSettings).not.toBe(store.settings);
    const { defaultDarkThemeProfile, defaultLightThemeProfile } = await import('@/config/AppearanceConfig');
    expect(toRaw(store.appearanceProjection!.lightThemeProfile)).toBe(defaultLightThemeProfile);
    expect(toRaw(store.appearanceProjection!.darkThemeProfile)).toBe(defaultDarkThemeProfile);
    expect(store.appearanceProjection?.resolvedThemeMode).toBe(ResolvedThemeMode.Light);
    store.draftSettings!.appearance.themeMode = ThemeMode.Dark;
    expect(store.hasPendingChanges).toBe(true);
    expect(store.settings?.appearance.themeMode).toBe(ThemeMode.System);
    expect(store.appearanceProjection?.resolvedThemeMode).toBe(ResolvedThemeMode.Light);
    await store.applySettings();
    expect(store.appearanceProjection?.resolvedThemeMode).toBe(ResolvedThemeMode.Dark);
    expect(store.hasPendingChanges).toBe(false);
    expect(store.draftSettings).not.toBe(store.settings);
    store.discardPendingSettings();
    expect(store.draftSettings?.appearance.themeMode).toBe(ThemeMode.Dark);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('saves and resets settings through the mocked domain service', async () => {
    const store = useSettingsStore();

    await store.loadSettings();
    store.updateSettings({ appearance: { themeMode: ThemeMode.System } as ISettingsSnapshot['appearance'] });
    await store.saveSettings();
    systemTheme = ResolvedThemeMode.Dark;
    themeChangedHandler?.(ResolvedThemeMode.Dark);
    expect(store.appearanceProjection?.resolvedThemeMode).toBe(ResolvedThemeMode.Dark);

    settingsSnapshot.appearance.themeMode = ThemeMode.Light;
    await store.resetSettings();
    expect(store.settings?.appearance.themeMode).toBe(ThemeMode.System);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
    expect(domain.UserSettingService.resetSettings).toHaveBeenCalledTimes(1);
  });
  it('rerenders draft, dirty, accepted, explicit, and system theme state', async () => {
    const store = useSettingsStore();
    await store.loadSettings();
    const wrapper = mount(defineComponent({
      setup: () => () => h('div', [
        h('span', { class: 'accepted-theme' }, store.settings?.appearance.themeMode ?? 'loading'),
        h('span', { class: 'draft-theme' }, store.draftSettings?.appearance.themeMode ?? 'loading'),
        h('span', { class: 'dirty' }, String(store.hasPendingChanges)),
        h('span', { class: 'resolved-theme' }, store.appearanceProjection?.resolvedThemeMode ?? 'loading'),
      ]),
    }));

    store.draftSettings!.appearance.themeMode = ThemeMode.Dark;
    await nextTick();
    expect(wrapper.get('.draft-theme').text()).toBe(ThemeMode.Dark);
    expect(wrapper.get('.accepted-theme').text()).toBe(ThemeMode.System);
    expect(wrapper.get('.dirty').text()).toBe('true');
    expect(wrapper.get('.resolved-theme').text()).toBe(ResolvedThemeMode.Light);

    await store.applySettings();
    await nextTick();
    expect(wrapper.get('.accepted-theme').text()).toBe(ThemeMode.Dark);
    expect(wrapper.get('.dirty').text()).toBe('false');
    expect(wrapper.get('.resolved-theme').text()).toBe(ResolvedThemeMode.Dark);

    store.draftSettings!.appearance.themeMode = ThemeMode.System;
    await store.applySettings();
    domain.UserSettingService.saveSettings.mockClear();
    themeChangedHandler?.(ResolvedThemeMode.Dark);
    await nextTick();
    expect(wrapper.get('.resolved-theme').text()).toBe(ResolvedThemeMode.Dark);
    themeChangedHandler?.(ResolvedThemeMode.Light);
    await nextTick();
    expect(wrapper.get('.resolved-theme').text()).toBe(ResolvedThemeMode.Light);
    expect(domain.UserSettingService.saveSettings).not.toHaveBeenCalled();
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
  it('loads and subscribes once, then disposes the system-theme subscription', async () => {
    const store = useSettingsStore();

    await Promise.all([store.loadSettings(), store.loadSettings()]);
    store.$dispose();

    expect(domain.UserSettingService.getSettingsOrDefault).toHaveBeenCalledTimes(1);
    expect(domain.PlatformEventService.subscribeToSystemThemeChanged).toHaveBeenCalledTimes(1);
    expect(disposeThemeSubscription).toHaveBeenCalledTimes(1);
    expect(themeChangedHandler).toBeUndefined();
  });
});
