# SessionStateService

## Purpose
Own layer-2 game-session and UI-layout persistence, including canonical document path rules plus load/save for the non-game persisted shell artefacts.

## Public Interface
```ts
getGameSessionOrDefault(): Promise<IGameSessionSnapshot>
saveGameSession(snapshot: IGameSessionSnapshot): Promise<void>
getLayoutStateOrDefault(): Promise<IUiLayoutState>
saveLayoutState(state: IUiLayoutState): Promise<void>
```

## Responsibilities
- wrap `StorageAdapter` and `SerializationService` for game-session and layout-state persistence without leaking file I/O to `UiStateStore`
- own the canonical file locations for `IGameSessionSnapshot` and `IUiLayoutState`
- lazily load persisted shell artefacts and fall back to the authoritative defaults when files are missing, corrupt, or invalid
- serialise accepted session or layout snapshots on save without coupling session persistence to settings or saved-game payload persistence

## Dependencies
- `StorageAdapter`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-02`
- `SCN-SESSION-03`
- `SCN-NAV-01`
- `SCN-NAV-02`
- `SCN-GAME-01`
- `SCN-LOAD-01`
- `SCN-IMPORT-01`
- `SCN-LIFECYCLE-01`
- `SCN-LIFECYCLE-02`

## Notes
- `SessionStateService` is the layer-2 session and layout persistence path referenced by `UiStateStore`.
- `SerializationService` remains pure; this service owns the storage-backed load and save boundary, not the payload contract itself.
