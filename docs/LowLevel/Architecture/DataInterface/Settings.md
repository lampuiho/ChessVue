# Settings Snapshot Types

## Purpose
Define the authoritative persisted settings schema from the baseline settings contract.

## Interfaces
- `interface ISettingsSession`
- `interface ISettingsGameDefaults`
- `interface ISettingsGameplay`
- `interface ISettingsAnalysis`
- `interface ISettingsAppearance`
- `interface ISettingsLayout`
- `interface ISettingsSnapshot`

## Data Structures
```ts
interface ISettingsSession {
  restorePreviousSession: boolean
  startupBehaviour: "restoreOrHome" | "home"
  autosaveEnabled: boolean
  autosaveDebounceMs: number
  autoPauseOnMenu: boolean
}

interface ISettingsGameDefaults {
  quickNewGameName: string
  defaultTimeControl: ITimeControl
  defaultWhitePlayerType: PlayerType
  defaultBlackPlayerType: PlayerType
}

interface ISettingsGameplay {
  takebackPolicy: "rewriteMainline" | "analysisOnly"
  confirmMainlineRewrite: boolean
  analysisBranchExitBehaviour: "returnToLiveNode" | "stayOnBranch"
  promotionPolicy: "requireExplicitSelection"
  confirmPruneFutureMoves: boolean
  allowRootPrune: boolean
}

interface ISettingsAnalysis {
  resumeLiveAnalysisAfterRestore: boolean
  engineInventory: IEngineRecord[]
}

interface ISettingsAppearance {
  boardTheme: string
  pieceTheme: string
  uiScalePercent: number
  boardOrientation: "white" | "black"
  showCoordinates: boolean
  highlightLastMove: boolean
}

interface ISettingsLayout {
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  showGameControlPanel: boolean
}

interface ISettingsSnapshot {
  schemaVersion: number
  session: ISettingsSession
  gameDefaults: ISettingsGameDefaults
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
  layout: ISettingsLayout
}
```

## Exclusions
The baseline schema does not include dark mode, sound settings, variant preferences, recent-game preferences, or mobile layout preferences.
