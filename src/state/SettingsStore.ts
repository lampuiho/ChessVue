import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import { ResolvedThemeMode, ThemeMode, type IAppearanceProjection, type ISettingsSnapshot } from '@/contracts';
import { PlatformEventService, UserSettingService } from '@/domain';
const lightVariables = {
  '--surface-app': '#f4efe3',
  '--surface-panel': '#fffaf0',
  '--surface-dialog': '#fffdf7',
  '--border-subtle': '#d6c7a7',
  '--text-primary': '#2f2617',
  '--text-muted': '#6c5d43',
  '--accent': '#b6692d',
  '--danger': '#a53030',
  '--focus-ring': '#d18a2f',
} satisfies IAppearanceProjection['cssVariables'];
const darkVariables = {
  '--surface-app': '#171b1f',
  '--surface-panel': '#222931',
  '--surface-dialog': '#29323b',
  '--border-subtle': '#465465',
  '--text-primary': '#eef2f6',
  '--text-muted': '#b2bfcb',
  '--accent': '#d7a24d',
  '--danger': '#f06b6b',
  '--focus-ring': '#f2c46d',
} satisfies IAppearanceProjection['cssVariables'];

function mergeSettings(currentSettings: ISettingsSnapshot, patch: Partial<ISettingsSnapshot>): ISettingsSnapshot {
  return {
    ...currentSettings,
    ...patch,
    gameSession: patch.gameSession ? { ...currentSettings.gameSession, ...patch.gameSession } : currentSettings.gameSession,
    gameDefaults: patch.gameDefaults ? { ...currentSettings.gameDefaults, ...patch.gameDefaults } : currentSettings.gameDefaults,
    gameplay: patch.gameplay ? { ...currentSettings.gameplay, ...patch.gameplay } : currentSettings.gameplay,
    analysis: patch.analysis ? { ...currentSettings.analysis, ...patch.analysis } : currentSettings.analysis,
    appearance: patch.appearance ? { ...currentSettings.appearance, ...patch.appearance } : currentSettings.appearance,
  };
}
function resolveThemeMode(settings: ISettingsSnapshot, systemTheme: ResolvedThemeMode): ResolvedThemeMode {
  switch (settings.appearance.themeMode) {
    case ThemeMode.Light: return ResolvedThemeMode.Light;
    case ThemeMode.Dark: return ResolvedThemeMode.Dark;
    default: return systemTheme;
  }
}
function buildAppearanceProjection(settings: ISettingsSnapshot, resolvedThemeMode: ResolvedThemeMode): IAppearanceProjection {
  return {
    themeMode: settings.appearance.themeMode,
    resolvedThemeMode,
    cssVariables: resolvedThemeMode === ResolvedThemeMode.Dark ? darkVariables : lightVariables,
  };
}

export const useSettingsStore = defineStore('settingsStore', () => {
  const _acceptedSettings = shallowRef<ISettingsSnapshot>();
  const _draftSettings = shallowRef<ISettingsSnapshot>();
  const _appearanceProjection = shallowRef<IAppearanceProjection>();
  let _initialisePromise: Promise<void> | undefined;
  let _disposeThemeSubscription: (() => void) | undefined;

  function _getAcceptedSettings(): ISettingsSnapshot {
    return _acceptedSettings.value ?? UserSettingService.getSettings();
  }
  function _getDraftSettings(): ISettingsSnapshot {
    return _draftSettings.value ?? _getAcceptedSettings();
  }
  async function _ensureInitialised(): Promise<void> {
    if (_initialisePromise) return _initialisePromise;
    _initialisePromise = (async () => {
      const acceptedSettings = await UserSettingService.getSettingsOrDefault();
      _acceptedSettings.value = acceptedSettings;
      _draftSettings.value = acceptedSettings;
      await _refreshAppearanceProjection();
      if (!_disposeThemeSubscription) {
        _disposeThemeSubscription = PlatformEventService.subscribeToSystemThemeChanged('SettingsStore', (theme) => {
          if ((_acceptedSettings.value ?? acceptedSettings).appearance.themeMode === ThemeMode.System) _appearanceProjection.value = buildAppearanceProjection(_acceptedSettings.value ?? acceptedSettings, resolveThemeMode(_acceptedSettings.value ?? acceptedSettings, theme));
        }, 'settings-theme-sync');
      }
    })();
    return _initialisePromise;
  }
  async function _refreshAppearanceProjection(): Promise<IAppearanceProjection> {
    const acceptedSettings = _acceptedSettings.value ?? await UserSettingService.getSettingsOrDefault();
    const resolvedThemeMode = resolveThemeMode(acceptedSettings, UserSettingService.getSystemTheme());
    const projection = buildAppearanceProjection(acceptedSettings, resolvedThemeMode);
    _appearanceProjection.value = projection;
    return projection;
  }
  function updateSettings(patch: Partial<ISettingsSnapshot>): void {
    const nextDraft = mergeSettings(_getDraftSettings(), patch);
    _draftSettings.value = nextDraft;
  }
  function hasPendingChanges(): boolean {
    return JSON.stringify(_getDraftSettings()) !== JSON.stringify(_getAcceptedSettings());
  }
  async function applySettings(): Promise<void> {
    await _ensureInitialised();
    const acceptedSettings = await UserSettingService.saveSettings(_getDraftSettings());
    _acceptedSettings.value = acceptedSettings;
    _draftSettings.value = acceptedSettings;
    await _refreshAppearanceProjection();
  }
  function discardPendingSettings(): void {
    _draftSettings.value = _getAcceptedSettings();
  }
  async function getSettings(): Promise<ISettingsSnapshot> {
    await _ensureInitialised();
    return _getAcceptedSettings();
  }
  function getDraftSettings(): ISettingsSnapshot {
    return _getDraftSettings();
  }
  async function getAppearanceProjection(): Promise<IAppearanceProjection> {
    await _ensureInitialised();
    return _appearanceProjection.value ?? await _refreshAppearanceProjection();
  }
  async function saveSettings(): Promise<void> {
    await _ensureInitialised();
    const acceptedSettings = await UserSettingService.saveSettings(_getDraftSettings());
    _acceptedSettings.value = acceptedSettings;
    _draftSettings.value = acceptedSettings;
    await _refreshAppearanceProjection();
  }
  async function resetSettings(): Promise<void> {
    const resetSettingsSnapshot = await UserSettingService.resetSettings();
    _acceptedSettings.value = resetSettingsSnapshot;
    _draftSettings.value = resetSettingsSnapshot;
    await _refreshAppearanceProjection();
  }

  return {
    getSettings,
    getDraftSettings,
    getAppearanceProjection,
    updateSettings,
    hasPendingChanges,
    applySettings,
    discardPendingSettings,
    saveSettings,
    resetSettings,
  };
});
