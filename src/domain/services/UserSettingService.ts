import { AnalysisBranchExitBehaviour, BoardOrientation, PlatformErrorKind, PlayerType, PromotionPolicy, ResolvedThemeMode, TakebackPolicy, ThemeMode, TimeControlPreset, settingsSnapshotSchema, type IPlatformError, type ISettingsSnapshot } from '@/contracts';
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
  });
}
function _coerceSettingsSnapshot(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  const acceptedSnapshot = structuredClone(snapshot);
  if (acceptedSnapshot.gameSession.restorePreviousSession) acceptedSnapshot.gameSession.autosaveOnClose = true;
  return acceptedSnapshot;
}
function _cacheAcceptedSettings(snapshot: ISettingsSnapshot): ISettingsSnapshot {
  _cachedSettings = _coerceSettingsSnapshot(snapshot);
  return structuredClone(_cachedSettings);
}
function _parseJson(raw: string): unknown {
  return JSON.parse(raw);
}
function _stripRuntimeMetadata<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => _stripRuntimeMetadata(item)) as T;
  if (typeof input !== 'object' || input === null) return input;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === '$') continue;
    output[key] = _stripRuntimeMetadata(value);
  }
  return output as T;
}
function _deserialiseSettings(raw: string): ISettingsSnapshot {
  return _coerceSettingsSnapshot(settingsSnapshotSchema.parse(_parseJson(raw)));
}
function _serialiseSettings(snapshot: ISettingsSnapshot): string {
  return JSON.stringify(_stripRuntimeMetadata(_coerceSettingsSnapshot(settingsSnapshotSchema.parse(snapshot))), null, 2);
}
async function _readSettingsDocument(path: string): Promise<ISettingsSnapshot> {
  return _deserialiseSettings(await usePlatformService().getStorageAdapter().readTextFile(path));
}
async function _writeSettingsDocument(path: string, snapshot: ISettingsSnapshot): Promise<void> {
  await usePlatformService().getStorageAdapter().writeTextFile(path, _serialiseSettings(snapshot), { overwrite: true });
}

export const UserSettingService = {
  async getSettingsOrDefault(): Promise<ISettingsSnapshot> {
    if (_cachedSettings !== undefined) return structuredClone(_cachedSettings);
    try {
      return _cacheAcceptedSettings(await _readSettingsDocument(BuildConfig.persistence.settingsPath));
    } catch (error) {
      if (!(_isPlatformError(error) && error.kind === PlatformErrorKind.NotFound)) console.error('[UserSettingService] Falling back to default settings.', error);
      return _cacheAcceptedSettings(_createDefaultSettingsSnapshot());
    }
  },
  getSettings(): ISettingsSnapshot {
    return structuredClone(_cachedSettings ?? _cacheAcceptedSettings(_createDefaultSettingsSnapshot()));
  },
  getSystemTheme(): ResolvedThemeMode {
    return usePlatformService().getSystemThemeAdapter().getSystemTheme();
  },
  async saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot> {
    const acceptedSettings = _coerceSettingsSnapshot(_deserialiseSettings(_serialiseSettings(snapshot)));
    await _writeSettingsDocument(BuildConfig.persistence.settingsPath, acceptedSettings);
    return _cacheAcceptedSettings(acceptedSettings);
  },
  async resetSettings(): Promise<ISettingsSnapshot> {
    const defaultSettings = _coerceSettingsSnapshot(_createDefaultSettingsSnapshot());
    await _writeSettingsDocument(BuildConfig.persistence.settingsPath, defaultSettings);
    return _cacheAcceptedSettings(defaultSettings);
  },
};
