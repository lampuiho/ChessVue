# Settings Snapshot Types

## Purpose
Define the authoritative persisted settings schema from the baseline settings contract.

## Interfaces
- `enum ThemeMode`
- `enum AnalysisBranchExitBehaviour`
- `enum PromotionPolicy`
- `enum BoardOrientation`
- `interface ISettingsGameSession`
- `ICreateGameRequest` supplies the defaults type and schema, excluding `rootPosition`
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

interface ISettingsGameplay {
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
  gameDefaults: Omit<ICreateGameRequest, 'rootPosition'>;
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}
```

## Exclusions
The baseline schema does not include user-created custom themes, sound settings, panel visibility or fold preferences, variant preferences, recent-game preferences, or mobile layout preferences.

The settings defaults schema derives from `createGameRequestSchema.omit({ rootPosition: true })`, with clock, seat and analysis-name refinements. Player/engine schemas strip runtime state. Default snapshots remain independent of reusable inventory entries; analysis profile IDs are copied metadata, not references.

Optional `gameDefaults.randomiseColours` defaults to false. The saved white/black slots are Player 1/Player 2 inputs when enabled; creation resolves their colours and persists those assignments in the game. Settings keep their original input snapshots for the next draw.
