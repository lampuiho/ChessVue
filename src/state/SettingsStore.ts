import { defineStore } from 'pinia';
import { computed, readonly, ref, shallowRef, toRaw } from 'vue';

import type { DeepReadonly, IAppearanceProjection, ISettingsSnapshot } from '@/contracts';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '@/config/AppearanceConfig';
import { UserSettingService } from '@/domain';
import { copyGameRequest } from '@/utility/GameCreationUtility';

function _mergeSettings(currentSettings: ISettingsSnapshot, patch: Partial<ISettingsSnapshot>): ISettingsSnapshot {
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
function _cloneSettings(settings: ISettingsSnapshot): ISettingsSnapshot {
  return {
    ...settings,
    gameSession: { ...settings.gameSession },
    gameDefaults: { ...settings.gameDefaults, ...copyGameRequest(settings.gameDefaults) },
    gameplay: { ...settings.gameplay },
    analysis: { ...settings.analysis, engineInventory: settings.analysis.engineInventory.map((engine) => ({ ...engine, options: { ...engine.options } })) },
    appearance: { ...settings.appearance },
  };
}
function _buildAppearanceProjection(settings: ISettingsSnapshot): IAppearanceProjection {
  return {
    themeMode: settings.appearance.themeMode,
    lightThemeProfile: defaultLightThemeProfile,
    darkThemeProfile: defaultDarkThemeProfile,
  };
}

export const useSettingsStore = defineStore('settingsStore', () => {
  const _settings = shallowRef<ISettingsSnapshot>();
  const draftSettings = ref<ISettingsSnapshot>(); //required for switching tabs. otherwise we would have local state in the vue component
  const recoveryWarning = ref('');
  let _initialisePromise: Promise<void> | undefined;

  const settings = computed<DeepReadonly<ISettingsSnapshot> | undefined>(() => _settings.value ? readonly(_settings.value) : undefined);
  const appearanceProjection = computed<IAppearanceProjection | undefined>(() => {
    if (!_settings.value) return;
    return _buildAppearanceProjection(_settings.value);
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
    draftSettings.value = _cloneSettings(acceptedSettings);
  }
  async function loadSettings() {
    if (_settings.value && draftSettings.value) return;
    if (_initialisePromise) return _initialisePromise;
    _initialisePromise = (async () => {
      const acceptedSettings = await UserSettingService.getSettingsOrDefault();
      recoveryWarning.value = UserSettingService.getLoadWarning();
      _acceptSettings(acceptedSettings);
    })();
    return _initialisePromise;
  }
  function updateSettings(patch: Partial<ISettingsSnapshot>) {
    draftSettings.value = _mergeSettings(_requireDraftSettings(), patch);
  }
  async function _saveDraftSettings() {
    await loadSettings();
    _acceptSettings(await UserSettingService.saveSettings(toRaw(_requireDraftSettings())));
  }
  function discardPendingSettings() {
    draftSettings.value = _cloneSettings(_requireSettings());
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
