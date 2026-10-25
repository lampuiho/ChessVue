import { AnalysisBranchExitBehaviour, BoardOrientation, PlayerColour, PlayerType, PromotionPolicy, ThemeMode, TimeControlPreset, type ISettingsSnapshot } from '@/contracts';
import { createEngineProfiles } from '../data/EngineProfile';

export function createSettings(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: { restorePreviousSession: true, saveRootPath: 'saves', autosaveAfterMoveCount: 1, autosaveOnClose: true, autoPauseOnMenu: true },
    gameDefaults: { name: 'New Game', timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 }, whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' }, blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' }, analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: false },
    gameplay: { analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode, promotionPolicy: PromotionPolicy.RequireExplicitSelection },
    analysis: { resumeLiveAnalysisAfterRestore: true, engineInventory: createEngineProfiles() },
    appearance: { themeMode: ThemeMode.System, boardTheme: 'classic', pieceTheme: 'classic', uiScalePercent: 100, boardOrientation: BoardOrientation.White, showCoordinates: true, highlightLastMove: true },
  };
}
