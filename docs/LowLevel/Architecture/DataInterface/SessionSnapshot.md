# Session State Types

## Purpose
Define the persisted game-session and UI-layout payloads used to restore the app workspace across launches.

## Interfaces
- `type SettingsCategory`
- `interface IGameSessionSnapshot`
- `interface IUiLayoutState`

## Data Structures
```ts
type SettingsCategory = "session" | "gameplay" | "appearance" | "engines"

interface IUiLayoutState {
  schemaVersion: number
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  historyCollapsed: boolean
  analysisCollapsed: boolean
  analysisEngineViewStateByGame: Record<string, Record<string, IAnalysisEngineViewState>>
}

interface IGameSessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId: string | null
  activeRoute: "/home" | `/game/${string}` | `/settings/${SettingsCategory}`
}
```

## Rules
- `IGameSessionSnapshot` stores reopenable shell state only.
- `IUiLayoutState` stores remembered non-modal UI state only.
- `IUiLayoutState` is one global layout snapshot for the app shell. It is stored once for the app even when some fold-state entries inside it are keyed by `gameId` and engine.
- `IUiLayoutState` persists visibility plus fold state for all committed foldable sections, including shared history-panel and analysis-panel collapse state and per-game analysis-engine groups.
- `IGameSessionSnapshot.activeRoute` stores canonical routed settings categories rather than the redirecting `/settings` alias.
- `session.restorePreviousSession` controls whether `IGameSessionSnapshot` is used during startup restore, but it does not block loading `IUiLayoutState`.
- Recent-game history lives in `IRecentGamesSnapshot`, not in either of these payloads.
- Conscious user preferences live in `ISettingsSnapshot`, not in either of these payloads.
- Modal visibility is transient and is not persisted here.
- Invalid or corrupt session-state payloads are discarded without affecting valid settings, valid recent-game history, or valid saved-game payloads.
