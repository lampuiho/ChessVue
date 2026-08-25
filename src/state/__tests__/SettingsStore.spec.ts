import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResolvedThemeMode, ThemeMode, type ISettingsSnapshot } from '@/contracts';

import { createSettingsSnapshot, resolveWithRandomDelay } from './StateStoreTestUtility';

let useSettingsStore: typeof import('..').useSettingsStore;
let settingsSnapshot: ISettingsSnapshot;
let systemTheme = ResolvedThemeMode.Light;
let themeChangedHandler: ((theme: ResolvedThemeMode) => void) | undefined;
const domain = {
  PlatformEventService: {
    subscribeToSystemThemeChanged: vi.fn((_owner: string, onChanged: (theme: ResolvedThemeMode) => void) => {
      themeChangedHandler = onChanged;
      return () => {
        if (themeChangedHandler === onChanged) themeChangedHandler = undefined;
      };
    }),
  },
  UserSettingService: {
    getSettings: vi.fn(() => structuredClone(settingsSnapshot)),
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
    getSystemTheme: vi.fn(() => systemTheme),
    saveSettings: vi.fn(async (snapshot: ISettingsSnapshot) => {
      settingsSnapshot = structuredClone(snapshot);
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
    const accepted = await store.getSettings();

    expect(accepted.analysis.engineInventory).toHaveLength(2);
    const appearanceProjection = await store.getAppearanceProjection();
    expect(appearanceProjection.resolvedThemeMode).toBe(ResolvedThemeMode.Light);
    expect(await store.getAppearanceProjection()).toBe(appearanceProjection);
    store.updateSettings({ appearance: { themeMode: ThemeMode.Dark } as ISettingsSnapshot['appearance'] });
    expect(store.hasPendingChanges()).toBe(true);
    await store.applySettings();
    expect((await store.getAppearanceProjection()).resolvedThemeMode).toBe(ResolvedThemeMode.Dark);
    store.discardPendingSettings();
    expect(store.getDraftSettings().appearance.themeMode).toBe(ThemeMode.Dark);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('saves and resets settings through the mocked domain service', async () => {
    const store = useSettingsStore();

    await store.getSettings();
    store.updateSettings({ appearance: { themeMode: ThemeMode.System } as ISettingsSnapshot['appearance'] });
    await store.saveSettings();
    systemTheme = ResolvedThemeMode.Dark;
    themeChangedHandler?.(ResolvedThemeMode.Dark);
    expect((await store.getAppearanceProjection()).resolvedThemeMode).toBe(ResolvedThemeMode.Dark);

    settingsSnapshot.appearance.themeMode = ThemeMode.Light;
    await store.resetSettings();
    expect((await store.getSettings()).appearance.themeMode).toBe(ThemeMode.System);
    expect(domain.UserSettingService.saveSettings).toHaveBeenCalledTimes(1);
    expect(domain.UserSettingService.resetSettings).toHaveBeenCalledTimes(1);
  });
});
