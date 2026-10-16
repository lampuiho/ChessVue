import { AnalysisBranchExitBehaviour, BoardOrientation, PlayerType, PromotionPolicy, ThemeMode, TimeControlPreset, type ISettingsSnapshot } from '@/contracts';
import { createEngineProfiles } from '../data/EngineProfile';

export function createSettings(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: { restorePreviousSession: true, saveRootPath: 'saves', autosaveAfterMoveCount: 1, autosaveOnClose: true, autoPauseOnMenu: true },
    gameDefaults: { quickNewGameName: 'New Game', defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 }, defaultWhitePlayerType: PlayerType.Local, defaultBlackPlayerType: PlayerType.Local },
    gameplay: { analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode, promotionPolicy: PromotionPolicy.RequireExplicitSelection },
    analysis: { resumeLiveAnalysisAfterRestore: true, engineInventory: createEngineProfiles() },
    appearance: { themeMode: ThemeMode.System, boardTheme: 'classic', pieceTheme: 'classic', uiScalePercent: 100, boardOrientation: BoardOrientation.White, showCoordinates: true, highlightLastMove: true },
  };
}
