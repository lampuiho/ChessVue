import { defineStore } from 'pinia';
import { computed, onScopeDispose, readonly, ref, shallowRef, toRaw } from 'vue';

import { ResolvedThemeMode, ThemeMode, type DeepReadonly, type IAppearanceProjection, type ISettingsSnapshot } from '@/contracts';
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
  const _settings = shallowRef<ISettingsSnapshot>();
  const draftSettings = ref<ISettingsSnapshot>(); //required for switching tabs. otherwise we would have local state in the vue component
  const _systemTheme = ref<ResolvedThemeMode>();
  let _initialisePromise: Promise<void> | undefined;
  let _disposeThemeSubscription: (() => void) | undefined;

  const settings = computed<DeepReadonly<ISettingsSnapshot> | undefined>(() => _settings.value ? readonly(_settings.value) : undefined);
  const appearanceProjection = computed<IAppearanceProjection | undefined>(() => {
    if (!_settings.value || !_systemTheme.value) return;
    return buildAppearanceProjection(_settings.value, resolveThemeMode(_settings.value, _systemTheme.value));
  });
  const hasPendingChanges = computed(() => {
    if (!_settings.value || !draftSettings.value) return false;
    return JSON.stringify(draftSettings.value) !== JSON.stringify(_settings.value);
  });

  function _requireSettings(): ISettingsSnapshot {
    if (!_settings.value) throw new Error('Settings must be loaded before they are read.');
    return _settings.value;
  }
  function _requireDraftSettings(): ISettingsSnapshot {
    if (!draftSettings.value) throw new Error('Settings must be loaded before the draft is changed.');
    return draftSettings.value;
  }
  function _acceptSettings(acceptedSettings: ISettingsSnapshot): void {
    _settings.value = acceptedSettings;
    draftSettings.value = structuredClone(acceptedSettings);
  }
  function _subscribeToSystemTheme(): void {
    if (_disposeThemeSubscription) return;
    _disposeThemeSubscription = PlatformEventService.subscribeToSystemThemeChanged('SettingsStore', (theme) => {
      _systemTheme.value = theme;
    }, 'settings-theme-sync');
  }
  async function loadSettings(): Promise<void> {
    if (_settings.value && draftSettings.value) return;
    if (_initialisePromise) return _initialisePromise;
    _initialisePromise = (async () => {
      const acceptedSettings = await UserSettingService.getSettingsOrDefault();
      _acceptSettings(acceptedSettings);
      _systemTheme.value = UserSettingService.getSystemTheme();
      _subscribeToSystemTheme();
    })();
    return _initialisePromise;
  }
  function updateSettings(patch: Partial<ISettingsSnapshot>): void {
    draftSettings.value = mergeSettings(_requireDraftSettings(), patch);
  }
  async function _saveDraftSettings(): Promise<void> {
    await loadSettings();
    _acceptSettings(await UserSettingService.saveSettings(toRaw(_requireDraftSettings())));
  }
  function discardPendingSettings(): void {
    draftSettings.value = structuredClone(_requireSettings());
  }
  async function applySettings(): Promise<void> {
    await _saveDraftSettings();
  }
  async function saveSettings(): Promise<void> {
    await _saveDraftSettings();
  }
  async function resetSettings(): Promise<void> {
    await loadSettings();
    _acceptSettings(await UserSettingService.resetSettings());
  }
  onScopeDispose(() => {
    _disposeThemeSubscription?.();
    _disposeThemeSubscription = undefined;
  });

  return {
    settings,
    draftSettings,
    appearanceProjection,
    hasPendingChanges,
    loadSettings,
    updateSettings,
    applySettings,
    discardPendingSettings,
    saveSettings,
    resetSettings,
  };
});
