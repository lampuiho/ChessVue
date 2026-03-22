# Settings Snapshot Types

## Purpose
Define the authoritative persisted settings schema from the baseline settings contract.

## Interfaces
- `interface ISettingsSession`
- `interface ISettingsGameDefaults`
- `interface ISettingsGameplay`
- `interface ISettingsAnalysis`
- `interface ISettingsAppearance`
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

interface ISettingsSnapshot {
  schemaVersion: number
  session: ISettingsSession
  gameDefaults: ISettingsGameDefaults
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}
```

## Exclusions
The baseline schema does not include dark mode, sound settings, panel visibility or fold preferences, variant preferences, recent-game preferences, or mobile layout preferences.
