import { AnalysisBranchExitBehaviour, BoardOrientation, PlatformErrorKind, PlayerType, PromotionPolicy, ResolvedThemeMode, ThemeMode, TimeControlPreset, settingsSnapshotSchema, type IPlatformError, type ISettingsSnapshot } from '@/contracts';
import { BuildConfig } from '@/config/BuildConfig';
import { usePlatformService } from '@/platform';

let _cachedSettings: ISettingsSnapshot | undefined;

function _isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}
function _createDefaultSettingsSnapshot(): ISettingsSnapshot {
  return _coerceSettingsSnapshot({
    schemaVersion: 1,
    gameSession: {
      restorePreviousSession: true,
      saveRootPath: 'saves',
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
    },
    gameplay: {
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
  });
}
function _coerceSettingsSnapshot(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  if (snapshot.gameSession.restorePreviousSession) snapshot.gameSession.autosaveOnClose = true;
  return snapshot;
}
function _cacheAcceptedSettings(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  return _cachedSettings = _coerceSettingsSnapshot(snapshot);
}
function _parseJson(raw: string): unknown {
  return JSON.parse(raw);
}
function _deserialiseSettings(raw: string): ISettingsSnapshot {
  return _coerceSettingsSnapshot(settingsSnapshotSchema.parse(_parseJson(raw)));
}
function _serialiseSettings(snapshot: ISettingsSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
async function _readSettingsDocument(path: string): Promise<ISettingsSnapshot> {
  return _deserialiseSettings(await usePlatformService().getStorageAdapter().readTextFile(path));
}
async function _writeSettingsDocument(path: string, snapshot: ISettingsSnapshot): Promise<void> {
  await usePlatformService().getStorageAdapter().writeTextFile(path, _serialiseSettings(snapshot), { overwrite: true });
}

export const UserSettingService = {
  async getSettingsOrDefault(): Promise<ISettingsSnapshot> {
    if (_cachedSettings) return _cachedSettings;
    try {
      return _cacheAcceptedSettings(await _readSettingsDocument(BuildConfig.persistence.settingsPath));
    } catch (error) {
      if (!(_isPlatformError(error) && error.kind === PlatformErrorKind.NotFound)) console.error('[UserSettingService] Falling back to default settings.', error);
      return _cacheAcceptedSettings(_createDefaultSettingsSnapshot());
    }
  },
  getSettings(): ISettingsSnapshot {
    return _cachedSettings ?? _cacheAcceptedSettings(_createDefaultSettingsSnapshot());
  },
  getSystemTheme(): ResolvedThemeMode {
    return usePlatformService().getSystemThemeAdapter().getSystemTheme();
  },
  async saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot> {
    const acceptedSettings = _coerceSettingsSnapshot(settingsSnapshotSchema.parse(snapshot));
    await _writeSettingsDocument(BuildConfig.persistence.settingsPath, acceptedSettings);
    return _cacheAcceptedSettings(acceptedSettings);
  },
  async resetSettings(): Promise<ISettingsSnapshot> {
    const defaultSettings = _createDefaultSettingsSnapshot();
    await _writeSettingsDocument(BuildConfig.persistence.settingsPath, defaultSettings);
    return _cacheAcceptedSettings(defaultSettings);
  },
};
