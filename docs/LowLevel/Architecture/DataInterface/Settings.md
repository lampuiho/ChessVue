# Settings Snapshot Types

## Purpose
Define the authoritative persisted settings schema from the baseline settings contract. Source: `contracts/Settings.ts`.

## Interfaces
- `enum AnalysisBranchExitBehaviour`
- `enum PromotionPolicy`
- `enum BoardOrientation`
- `interface ISettingsGameSession`
- `interface ISettingsGameplay`
- `interface ISettingsAnalysis`
- `interface ISettingsAppearance`
- `interface ISettingsSnapshot`

`ThemeMode` is defined in [Appearance](Appearance.md); `gameDefaults` reuses `ICreateGameRequest` from [Game](Game.md) without `rootPosition`.

## Data Structures
```ts
const enum AnalysisBranchExitBehaviour {
  ReturnToLiveNode = "returnToLiveNode",
  StayOnBranch = "stayOnBranch"
}

const enum PromotionPolicy {
  RequireExplicitSelection = "requireExplicitSelection"
}

const enum BoardOrientation {
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
  gameDefaults: Omit<ICreateGameRequest, "rootPosition">
  gameplay: ISettingsGameplay
  analysis: ISettingsAnalysis
  appearance: ISettingsAppearance
}
```

## Schemas
- `analysisBranchExitBehaviours`, `promotionPolicies`, and `boardOrientations` feed `analysisBranchExitBehaviourSchema`, `promotionPolicySchema`, and `boardOrientationSchema`.
- `settingsGameSessionSchema` requires a non-empty `saveRootPath` and an integer `autosaveAfterMoveCount >= 0`.
- `settingsGameDefaultsSchema` is `createGameRequestSchema.omit({ rootPosition: true })` refined by `getGameCreationError(...)`: a non-blank name, a valid clock for its preset, seats whose `colour` matches the White or Black slot, a non-blank engine entry path for every engine seat, at most four analysis profiles each with a non-blank entry path, and unique analysis display names. Player and engine schemas strip runtime state.
- `settingsAnalysisSchema` rejects duplicate `displayName` values in `engineInventory`.
- `settingsAppearanceSchema` requires non-empty `boardTheme` and `pieceTheme` and an integer `uiScalePercent` from `75` to `200`.
- `settingsSnapshotSchema` requires `schemaVersion: 1`.

## Rules
- Built-in defaults are created by `UserSettingService` and listed in the high-level [settings contract](../../../HighLevel/settings_contract.md). They include the bundled Stockfish profile in `engineInventory` and as the default Black player.
- Accepted snapshots are coerced by `UserSettingService`: `restorePreviousSession = true` forces `autosaveOnClose = true`, `gameDefaults.name` is trimmed, an omitted `gameDefaults.allowTakeback` becomes `true`, and an omitted `gameDefaults.showLiveAnalysisMoves` becomes `false`.
- `gameDefaults` keeps the request shape so Quick and Custom game can reuse one validation and copy path. Default snapshots remain independent of reusable inventory entries; analysis profile IDs are copied metadata, not references. The design is recorded in the archived [quick game defaults design](../../../ArchivedPlans/QuickGameDefaultsDesign.md).
- An omitted `gameDefaults.randomiseColours` means fixed colours. When enabled, the saved White and Black slots are the Player 1 and Player 2 inputs; they keep their canonical colours so shared validation still applies. Creation resolves the draw and persists the resulting assignments in the game, while settings keep their original input snapshots for the next draw.
- `gameplay.analysisBranchExitBehaviour` is persisted and editable in Settings. **Planned:** the analysis exit flow consumes it; leaving in-game analysis currently always returns to the live node.
- `gameplay.promotionPolicy` has only `requireExplicitSelection`; local board promotion always asks for the piece through `PromotionModal`, so no code branches on the value.
- `appearance.boardTheme` and `appearance.pieceTheme` persist theme keys (`classic`) reserved for future board and piece themes. Presentation does not read them.
- `appearance.themeMode` drives the app chrome as described in [Appearance](Appearance.md); `uiScalePercent`, `boardOrientation`, `showCoordinates`, and `highlightLastMove` are applied by presentation directly.

## Exclusions
The baseline schema does not include user-created custom themes, sound settings, panel visibility or fold preferences, variant preferences, recent-game preferences, or mobile layout preferences.
