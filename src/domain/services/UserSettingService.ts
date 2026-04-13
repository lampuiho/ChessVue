import { AnalysisBranchExitBehaviour, BoardOrientation, PlatformErrorKind, PlayerType, PromotionPolicy, ResolvedThemeMode, TakebackPolicy, ThemeMode, TimeControlPreset, type IPlatformError, type ISettingsSnapshot } from '@/contracts';
import { usePlatformService } from '@/platform';

import { SerializationService } from './SerializationService';

const _settingsPath = 'settings.json';
let _cachedSettings: ISettingsSnapshot | null = null;

function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}
function createDefaultSettingsSnapshot(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    session: {
      restorePreviousSession: true,
      saveRootPath: 'saves',
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, initialMs: null, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
    },
    gameplay: {
      takebackPolicy: TakebackPolicy.RewriteMainline,
      confirmMainlineRewrite: true,
      analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode,
      promotionPolicy: PromotionPolicy.RequireExplicitSelection,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [],
    },
    appearance: {
      themeMode: ThemeMode.System,
      boardTheme: 'classic',
      pieceTheme: 'classic',
      uiScalePercent: 100,
      boardOrientation: BoardOrientation.White,
      showCoordinates: true,
      highlightLastMove: true,
    },
  };
}
function cacheAcceptedSettings(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  _cachedSettings = structuredClone(snapshot);
  return structuredClone(_cachedSettings);
}

export const UserSettingService = {
  async getSettingsOrDefault(): Promise<ISettingsSnapshot> {
    if (_cachedSettings !== null) return structuredClone(_cachedSettings);
    const storageAdapter = usePlatformService().getStorageAdapter();
    try {
      return cacheAcceptedSettings(SerializationService.deserialiseSettings(await storageAdapter.readTextFile(_settingsPath)));
    } catch (error) {
      if (!(isPlatformError(error) && error.kind === PlatformErrorKind.NotFound)) console.error('[UserSettingService] Falling back to default settings.', error);
      return cacheAcceptedSettings(createDefaultSettingsSnapshot());
    }
  },
  getSettings(): ISettingsSnapshot {
    return structuredClone(_cachedSettings ?? cacheAcceptedSettings(createDefaultSettingsSnapshot()));
  },
  getSystemTheme(): ResolvedThemeMode {
    return usePlatformService().getSystemThemeAdapter().getSystemTheme();
  },
  async saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot> {
    const acceptedSettings = SerializationService.deserialiseSettings(SerializationService.serialiseSettings(snapshot));
    await usePlatformService().getStorageAdapter().writeTextFile(_settingsPath, SerializationService.serialiseSettings(acceptedSettings), true);
    return cacheAcceptedSettings(acceptedSettings);
  },
  async resetSettings(): Promise<ISettingsSnapshot> {
    const defaultSettings = createDefaultSettingsSnapshot();
    await usePlatformService().getStorageAdapter().writeTextFile(_settingsPath, SerializationService.serialiseSettings(defaultSettings), true);
    return cacheAcceptedSettings(defaultSettings);
  },
};
