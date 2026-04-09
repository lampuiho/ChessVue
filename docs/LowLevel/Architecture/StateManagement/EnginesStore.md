# EnginesStore

## Purpose
Expose configured engine inventory for UI-facing selection flows and construct engine-backed `IEnginePlayer` values for seating.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | null
createPlayer(engineId: string, colour: PlayerColour): Promise<IEnginePlayer>
validateAnalysisSelection(engineIds: string[]): void
```

## Responsibilities
- read configured engine profiles when creating or validating assigned engine participants
- construct engine-backed `IEnginePlayer` values from accepted engine profiles so presentation can seat them into a game without same-layer store calls
- enforce the four-engine analysis cap
- preserve copied player-engine and analysis-engine configuration for the lifetime of that assignment unless the user explicitly unseats and reseats the engine

## Runtime Gating Notes
- Engine-profile editing is owned by `SettingsStore`; already assigned games keep their captured engine snapshots until the user explicitly reassigns them.
- `createPlayer(...)` returns an engine-backed `IEnginePlayer` with copied launch configuration from the selected reusable profile. Later profile edits or profile deletion do not mutate already seated players.
- Analysis-runtime and player-move orchestration are owned by `GamesStore` through layer-2 services, not by this store.

## Dependencies
- `UserSettingService`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-ANALYSIS-05`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `EnginesStore` is intentionally inventory-facing. It does not own live turn waiting, analysis refresh timing, or engine-process orchestration.
- `GamesStore` remains responsible for analysis coordination and non-local move waiting on the current game.
- Presentation bridges `EnginesStore.createPlayer(...)` into `GamesStore.reassignPlayer(...)` so the no-sibling-store-call rule stays intact.
