# Session State Types

## Purpose
Define the persisted game-session and UI-layout payloads used to restore the app workspace across launches.

## Interfaces
- `interface IGameSessionSnapshot`
- `interface IUiLayoutState`

## Data Structures
```ts
interface IUiLayoutState {
  schemaVersion: number
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  showGameControlPanel: boolean
  historyCollapsed: boolean
  analysisCollapsed: boolean
}

interface IGameSessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId: string | null
  activeRoute: "/home" | `/game/${string}` | "/settings"
}
```

## Rules
- `IGameSessionSnapshot` stores reopenable shell state only.
- `IUiLayoutState` stores remembered non-modal UI state only.
- `IUiLayoutState` is one global layout snapshot for the app shell and is not keyed by `gameId`.
- `session.restorePreviousSession` controls whether `IGameSessionSnapshot` is used during startup restore, but it does not block loading `IUiLayoutState`.
- Recent-game history lives in `IRecentGamesSnapshot`, not in either of these payloads.
- Conscious user preferences live in `ISettingsSnapshot`, not in either of these payloads.
- Modal visibility is transient and is not persisted here.
- Invalid or corrupt session-state payloads are discarded without affecting valid settings, valid recent-game history, or valid saved-game payloads.
