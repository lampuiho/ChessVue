import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalysisBranchExitBehaviour,
  BoardOrientation,
  PlatformErrorKind,
  PlayerType,
  PromotionPolicy,
  ResolvedThemeMode,
  ThemeMode,
  TimeControlPreset,
  type ISettingsSnapshot,
} from '@/contracts';
import type { IStorageAdapter } from '@/contracts/platform';

let UserSettingService: typeof import('..').UserSettingService;
const readTextFile = vi.fn<IStorageAdapter['readTextFile']>();
const writeTextFile = vi.fn<IStorageAdapter['writeTextFile']>();
const getSystemTheme = vi.fn(() => ResolvedThemeMode.Light);

function createSettingsSnapshot(): ISettingsSnapshot {
  return {
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
  } as ISettingsSnapshot;
}

describe('UserSettingService', () => {
  beforeEach(async () => {
    vi.resetModules();
    readTextFile.mockReset();
    writeTextFile.mockReset();
    getSystemTheme.mockReset();
    getSystemTheme.mockReturnValue(ResolvedThemeMode.Light);
    vi.doMock('@/platform', () => ({
      usePlatformService: () => ({
        getStorageAdapter: () => ({
          readTextFile,
          writeTextFile,
        }),
        getSystemThemeAdapter: () => ({
          getSystemTheme,
        }),
      }),
    }));
    ({ UserSettingService } = await import('..'));
  });

  it('falls back to default settings when the mocked platform storage reports not found', async () => {
    readTextFile.mockRejectedValue({
      kind: PlatformErrorKind.NotFound,
      operation: 'readTextFile',
      message: 'Missing settings document.',
    });

    const settings = await UserSettingService.getSettingsOrDefault();

    expect(readTextFile).toHaveBeenCalledTimes(1);
    expect(settings.appearance.themeMode).toBe(ThemeMode.System);
    settings.appearance.themeMode = ThemeMode.Dark;
    expect(UserSettingService.getSettings()).toBe(settings);
    expect(UserSettingService.getSettings().appearance.themeMode).toBe(ThemeMode.Dark);
  });

  it('serialises accepted settings through the mocked platform storage adapter', async () => {
    const settings = createSettingsSnapshot();
    settings.gameSession.restorePreviousSession = true;
    settings.gameSession.autosaveOnClose = false;
    (settings as ISettingsSnapshot & { $?: { dirty: boolean } }).$ = { dirty: true };

    const accepted = await UserSettingService.saveSettings(settings);

    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile.mock.calls[0]?.[0]).toBe('settings.json');
    expect(writeTextFile.mock.calls[0]?.[2]).toEqual({ overwrite: true });
    expect(writeTextFile.mock.calls[0]?.[1]).toContain('"autosaveOnClose": true');
    expect(writeTextFile.mock.calls[0]?.[1]).not.toContain('"$"');
    expect(accepted.gameSession.autosaveOnClose).toBe(true);
  });

  it('reads the system theme through the mocked platform service', () => {
    getSystemTheme.mockReturnValue(ResolvedThemeMode.Dark);

    expect(UserSettingService.getSystemTheme()).toBe(ResolvedThemeMode.Dark);
  });
});
