import { defineStore } from 'pinia';
import { computed, onScopeDispose, readonly, ref, shallowRef, toRaw } from 'vue';

import { ResolvedThemeMode, ThemeMode, type DeepReadonly, type IAppearanceProjection, type ISettingsSnapshot } from '@/contracts';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { PlatformEventService, UserSettingService } from '@/domain';

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
function cloneSettings(settings: ISettingsSnapshot): ISettingsSnapshot {
  return {
    ...settings,
    gameSession: { ...settings.gameSession },
    gameDefaults: { ...settings.gameDefaults, defaultTimeControl: { ...settings.gameDefaults.defaultTimeControl } },
    gameplay: { ...settings.gameplay },
    analysis: { ...settings.analysis, engineInventory: settings.analysis.engineInventory.map((engine) => ({ ...engine, options: { ...engine.options } })) },
    appearance: { ...settings.appearance },
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
    lightThemeProfile: defaultLightThemeProfile,
    darkThemeProfile: defaultDarkThemeProfile,
  };
}

export const useSettingsStore = defineStore('settingsStore', () => {
  const _settings = shallowRef<ISettingsSnapshot>();
  const draftSettings = ref<ISettingsSnapshot>(); //required for switching tabs. otherwise we would have local state in the vue component
  const _systemTheme = ref<ResolvedThemeMode>();
  const recoveryWarning = ref('');
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
  function _acceptSettings(acceptedSettings: ISettingsSnapshot) {
    _settings.value = acceptedSettings;
    draftSettings.value = cloneSettings(acceptedSettings);
  }
  function _subscribeToSystemTheme() {
    if (_disposeThemeSubscription) return;
    _disposeThemeSubscription = PlatformEventService.subscribeToSystemThemeChanged('SettingsStore', (theme) => {
      _systemTheme.value = theme;
    }, 'settings-theme-sync');
  }
  async function loadSettings() {
    if (_settings.value && draftSettings.value) return;
    if (_initialisePromise) return _initialisePromise;
    _initialisePromise = (async () => {
      const acceptedSettings = await UserSettingService.getSettingsOrDefault();
      recoveryWarning.value = UserSettingService.getLoadWarning();
      _acceptSettings(acceptedSettings);
      _systemTheme.value = UserSettingService.getSystemTheme();
      _subscribeToSystemTheme();
    })();
    return _initialisePromise;
  }
  function updateSettings(patch: Partial<ISettingsSnapshot>) {
    draftSettings.value = mergeSettings(_requireDraftSettings(), patch);
  }
  async function _saveDraftSettings() {
    await loadSettings();
    _acceptSettings(await UserSettingService.saveSettings(toRaw(_requireDraftSettings())));
  }
  function discardPendingSettings() {
    draftSettings.value = cloneSettings(_requireSettings());
  }
  async function applySettings() {
    await _saveDraftSettings();
  }
  async function saveSettings() {
    await _saveDraftSettings();
  }
  async function resetSettings() {
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
    recoveryWarning,
    loadSettings,
    updateSettings,
    applySettings,
    discardPendingSettings,
    saveSettings,
    resetSettings,
  };
});
