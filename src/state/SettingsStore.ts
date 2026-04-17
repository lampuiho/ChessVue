import { defineStore } from 'pinia';
import { ref } from 'vue';

import { ThemeMode, type IAppearanceProjection, type ISettingsSnapshot } from '@/contracts';
import { PlatformEventService, UserSettingService } from '@/domain';
import { buildAppearanceProjection, resolveThemeMode } from '@/utility/state';

function cloneSettings(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  return structuredClone(snapshot);
}
function mergeSettings(currentSettings: ISettingsSnapshot, patch: Partial<ISettingsSnapshot>): ISettingsSnapshot {
  return {
    ...currentSettings,
    ...patch,
    gameSession: patch.gameSession ? { ...currentSettings.gameSession, ...patch.gameSession } : { ...currentSettings.gameSession },
    gameDefaults: patch.gameDefaults ? { ...currentSettings.gameDefaults, ...patch.gameDefaults } : { ...currentSettings.gameDefaults },
    gameplay: patch.gameplay ? { ...currentSettings.gameplay, ...patch.gameplay } : { ...currentSettings.gameplay },
    analysis: patch.analysis ? { ...currentSettings.analysis, ...patch.analysis } : { ...currentSettings.analysis },
    appearance: patch.appearance ? { ...currentSettings.appearance, ...patch.appearance } : { ...currentSettings.appearance },
  };
}

export const useSettingsStore = defineStore('settingsStore', () => {
  const _acceptedSettings = ref<ISettingsSnapshot>();
  const _draftSettings = ref<ISettingsSnapshot>();
  const _appearanceProjection = ref<IAppearanceProjection>();
  let _initialisePromise: Promise<void> | undefined;
  let _disposeThemeSubscription: (() => void) | undefined;

  function _getAcceptedSettings(): ISettingsSnapshot {
    return cloneSettings(_acceptedSettings.value ?? UserSettingService.getSettings());
  }
  function _getDraftSettings(): ISettingsSnapshot {
    return cloneSettings(_draftSettings.value ?? _getAcceptedSettings());
  }
  async function _ensureInitialised(): Promise<void> {
    if (_initialisePromise) return _initialisePromise;
    _initialisePromise = (async () => {
      const acceptedSettings = await UserSettingService.getSettingsOrDefault();
      _acceptedSettings.value = cloneSettings(acceptedSettings);
      _draftSettings.value = cloneSettings(acceptedSettings);
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
    return structuredClone(projection);
  }
  function updateSettings(patch: Partial<ISettingsSnapshot>): void {
    const nextDraft = mergeSettings(_getDraftSettings(), patch);
    _draftSettings.value = nextDraft;
  }
  function hasPendingChanges(): boolean {
    return JSON.stringify(_getDraftSettings()) !== JSON.stringify(_getAcceptedSettings());
  }
  function applySettings(): void {
    _acceptedSettings.value = _getDraftSettings();
    void _refreshAppearanceProjection();
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
    return structuredClone(_appearanceProjection.value ?? await _refreshAppearanceProjection());
  }
  async function saveSettings(): Promise<void> {
    await _ensureInitialised();
    const acceptedSettings = await UserSettingService.saveSettings(_getDraftSettings());
    _acceptedSettings.value = cloneSettings(acceptedSettings);
    _draftSettings.value = cloneSettings(acceptedSettings);
    await _refreshAppearanceProjection();
  }
  async function resetSettings(): Promise<void> {
    const resetSettingsSnapshot = await UserSettingService.resetSettings();
    _acceptedSettings.value = cloneSettings(resetSettingsSnapshot);
    _draftSettings.value = cloneSettings(resetSettingsSnapshot);
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
