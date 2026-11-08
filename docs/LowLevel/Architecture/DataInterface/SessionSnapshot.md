# Session State Types

## Purpose
Define the persisted game-session and UI-layout payloads used to restore the app workspace across launches. Source: `contracts/SessionSnapshot.ts`.

## Interfaces
- `enum SettingsCategory`
- `interface IUiLayoutState`
- `interface IGameSessionSnapshot`

## Data Structures
```ts
const enum SettingsCategory {
  Session = "session",
  Gameplay = "gameplay",
  Appearance = "appearance",
  Engines = "engines"
}

interface IUiLayoutState {
  schemaVersion: number
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  historyCollapsed: boolean
  analysisCollapsed: boolean
  analysisEngineExpandedByIndex: boolean[]
}

interface IGameSessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId?: string
  activeRoute:
    | "/home"
    | `/game/${string}`
    | "/saved-games/load"
    | `/saved-games/load/${string}`
    | `/saved-games/save/${string}`
    | `/settings/${SettingsCategory}`
}
```

## Schemas
- `settingsCategories` feeds `settingsCategorySchema`.
- `activeRouteSchema` is a regular expression matching exactly the committed route family above, with a non-empty game, load, or save segment and one of the four settings categories.
- `uiLayoutStateSchema` and `gameSessionSnapshotSchema` require `schemaVersion: 1`. The session schema requires non-empty `openGameIds` entries and a non-empty `activeGameId` when present; `SerializationService` additionally rejects an `activeGameId` that is not in `openGameIds`.

## Rules
- `IGameSessionSnapshot` stores reopenable shell state only.
- `IUiLayoutState` stores remembered non-modal UI state only.
- `IUiLayoutState` is one global layout snapshot for the app shell.
- `IUiLayoutState` persists visibility plus fold state for all committed foldable sections, including shared history-panel and analysis-panel collapse state and analysis-engine groups by rendered row index for the active game.
- `analysisEngineExpandedByIndex[index] = true` means the analysis-engine row at that rendered index for the active game is expanded, `false` means collapsed, and a missing entry defaults to expanded.
- The rendered row order is derived from `IGame.analysis.seats` for the active game and is recalculated whenever the active game changes.
- `IGameSessionSnapshot.activeGameId` identifies the selected open game tab only when present; it is not part of layout persistence.
- `IGameSessionSnapshot.activeRoute` stores the canonical committed route directly as a route string rather than through an enum-backed route object.
- `IGameSessionSnapshot.activeRoute` is limited to the committed route family and does not store redirect-only aliases such as `/settings`. The engine profile and package child routes under `/settings/engines/...` are not committed routes either; navigating to them leaves the previously committed route in place.
- On load, `UiStateStore` coerces the snapshot: duplicate or empty open IDs are dropped, `activeGameId` falls back to the first open game, and an invalid route, or a game route for a game that is not open, falls back to the active game's route or `/home`.
- `gameSession.restorePreviousSession` controls whether `IGameSessionSnapshot` is used during startup restore, but it does not block loading `IUiLayoutState`.
- Recent-game history is derived on demand for `HomeView`, not stored in either of these payloads.
- Conscious user preferences live in `ISettingsSnapshot`, not in either of these payloads.
- Modal visibility is transient and is not persisted here.
- Invalid or corrupt session-state payloads are discarded without affecting valid settings, valid recent-game queries, or valid saved-game payloads.
