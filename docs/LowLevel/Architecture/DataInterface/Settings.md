# Settings Snapshot Types

## Purpose
Define the authoritative persisted settings schema from the baseline settings contract.

## Interfaces
- `enum ThemeMode`
- `enum TakebackPolicy`
- `enum AnalysisBranchExitBehaviour`
- `enum PromotionPolicy`
- `enum BoardOrientation`
- `interface ISettingsGameSession`
- `interface ISettingsGameDefaults`
- `interface ISettingsGameplay`
- `interface ISettingsAnalysis`
- `interface ISettingsAppearance`
- `interface ISettingsSnapshot`

## Data Structures
```ts
enum ThemeMode {
  System = "system",
  Light = "light",
  Dark = "dark"
}

enum TakebackPolicy {
  RewriteMainline = "rewriteMainline",
  AnalysisOnly = "analysisOnly"
}

enum AnalysisBranchExitBehaviour {
  ReturnToLiveNode = "returnToLiveNode",
  StayOnBranch = "stayOnBranch"
}

enum PromotionPolicy {
  RequireExplicitSelection = "requireExplicitSelection"
}

enum BoardOrientation {
  White = "white",
  Black = "black"
}

interface ISettingsGameSession {
  restorePreviousSession: boolean
  saveRootPath: string
  autosaveAfterMoveCount: number
  autosaveOnClose: boolean
  autoPauseOnMenu: boolean
}

interface ISettingsGameDefaults {
  quickNewGameName: string
  defaultTimeControl: ITimeControl
  defaultWhitePlayerType: PlayerType
  defaultBlackPlayerType: PlayerType
}

interface ISettingsGameplay {
  takebackPolicy: TakebackPolicy
  confirmMainlineRewrite: boolean
  analysisBranchExitBehaviour: AnalysisBranchExitBehaviour
  promotionPolicy: PromotionPolicy
}

interface ISettingsAnalysis {
  resumeLiveAnalysisAfterRestore: boolean
  engineInventory: IEngineRecord[]
}

interface ISettingsAppearance {
  themeMode: ThemeMode
  boardTheme: string
  pieceTheme: string
  uiScalePercent: number
  boardOrientation: BoardOrientation
  showCoordinates: boolean
  highlightLastMove: boolean
}

interface ISettingsSnapshot {
  schemaVersion: number
  gameSession: ISettingsGameSession
  gameDefaults: ISettingsGameDefaults
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}
```

## Exclusions
The baseline schema does not include user-created custom themes, sound settings, panel visibility or fold preferences, variant preferences, recent-game preferences, or mobile layout preferences.
