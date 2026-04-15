# EnginesStore

## Purpose
Expose configured engine inventory for UI-facing selection flows.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | undefined
validateAnalysisSelection(engineIds: string[]): void
```

## Responsibilities
- read configured engine profiles when creating or validating selection options for assigned engine participants
- enforce the four-engine analysis cap
- leave copied player-engine and analysis-engine assignment ownership to `GamesStore` once the UI has selected a reusable profile

## Runtime Gating Notes
- Engine-profile editing is owned by `SettingsStore`; already assigned games keep their captured engine snapshots until the user explicitly reassigns them.
- UI selection flows read reusable engine profiles from `EnginesStore` and pass the selected profile to `GamesStore`, which owns copying that profile into the game's persisted assigned-engine snapshot.
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
- Presentation bridges `EnginesStore` profile selection into `GamesStore` assignment flows so the no-sibling-store-call rule stays intact.
