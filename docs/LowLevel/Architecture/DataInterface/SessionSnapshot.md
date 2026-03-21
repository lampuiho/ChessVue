# Session Snapshot Types

## Purpose
Define the persisted shell/session payload used to restore the app workspace across launches.

## Interfaces
- `interface ISessionLayoutState`
- `interface ISessionSnapshot`

## Data Structures
```ts
interface ISessionLayoutState {
  showHistoryPanel: boolean
  showAnalysisPanel: boolean
  showGameControlPanel: boolean
}

interface ISessionSnapshot {
  schemaVersion: number
  openGameIds: string[]
  activeGameId: string | null
  activeRoute: "/home" | `/game/${string}` | "/settings"
  activeGameLayoutById: Record<string, ISessionLayoutState>
}
```

## Rules
- Session snapshot stores shell restoration only.
- Modal visibility is transient and is not persisted here.
- Invalid or corrupt session payloads are discarded without affecting valid settings or valid game documents.
