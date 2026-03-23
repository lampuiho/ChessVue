# Modal State Types

## Purpose
Define the typed transient modal states owned by `UiStateStore`.

## Types
- `type AppModalKind = "newGame" | "promotion" | "pruneFuture" | "startGameFromSetup" | "resign" | "timeout" | "importError" | "resetSettings" | "deleteGame" | "boardEditBlocked"`

## Interfaces
- `interface IAppModalState`

## Data Structures
```ts
type AppModalKind =
  | "newGame"
  | "promotion"
  | "pruneFuture"
  | "startGameFromSetup"
  | "resign"
  | "timeout"
  | "importError"
  | "resetSettings"
  | "deleteGame"
  | "boardEditBlocked"

interface IAppModalState {
  kind: AppModalKind
  payload?: Record<string, unknown>
}
```

## Rules
- Modal state is transient UI state only and is never persisted in `IGameSessionSnapshot`, `IUiLayoutState`, or `IGameWorkspace`.
- The modal contract exists to replace untyped string IDs and `unknown` payloads at the store boundary.
- Concrete modal payload shapes may be refined later without changing the committed modal kind list.
