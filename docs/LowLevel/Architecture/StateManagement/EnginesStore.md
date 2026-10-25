# EnginesStore

## Purpose
Own configured engine profiles and their transient discovered-option metadata for profile editing and UI-facing selection flows.

## Public Interface
```ts
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | undefined
getOptionMeta(engineProfile: IEngineRecord | string): readonly IEngineOptionMeta[] | undefined
loadOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>
refreshOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>
validateAnalysisSelection(engineIds: string[]): void
```

## Responsibilities
- read configured engine profiles when creating or validating selection options for assigned engine participants
- cache protocol-neutral option metadata by engine profile id for the profile configuration view
- load or explicitly refresh option metadata through `EngineRuntimeService`
- invalidate cached metadata when the profile entry path or client type changes
- enforce the four-engine analysis cap
- leave copied player-engine and analysis-engine assignment ownership to `GamesStore` once the UI has selected a reusable profile

## Runtime Gating Notes
- Engine-profile configuration belongs to `EnginesStore`; `SettingsStore` remains focused on user settings.
- Cached option metadata is runtime-only store state. It is neither added to `IEngineRecord` nor persisted with settings.
- Saved `IEngineRecord.options` values remain authoritative. Metadata discovery does not populate, validate, or reconcile that map.
- UI selection flows read reusable engine profiles from `EnginesStore` and pass the selected profile to `GamesStore`, which owns copying that profile into the game's persisted assigned-engine snapshot.
- Analysis-runtime and player-move orchestration are owned by `GamesStore` through layer-2 services, not by this store.

## Dependencies
- `UserSettingService`
- `EngineRuntimeService`
- `EnginePackageService`

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-ANALYSIS-05`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `EnginesStore` is intentionally inventory-facing. It does not own live turn waiting, analysis refresh timing, or engine-process orchestration.
- `loadOptionMeta(...)` reuses current cached metadata, while `refreshOptionMeta(...)` always starts a temporary discovery runtime. Only a successful discovery replaces the cache.
- Metadata methods accept either a configured profile id or a draft `IEngineRecord`, allowing the add-profile editor to inspect an engine before that profile is persisted.
- Temporary discovery runtimes are owned and closed by `EngineRuntimeService`; the store retains only the copied metadata returned after closure.
- `GamesStore` remains responsible for analysis coordination and non-local move waiting on the current game.
- Presentation bridges `EnginesStore` profile selection into `GamesStore` assignment flows so the no-sibling-store-call rule stays intact.

## Package actions

canInstallPackages, refreshPackages, listPackages, getPackage, browseEngineFile, readArchive, installPackage and removePackage delegate to EnginePackageService. The store owns a transient folder list and a settled queue for reads/mutations. Concurrent refresh callers share the outstanding read; a mutation intervening in the queue requires a new read. Installation/removal rediscover after commit and report discovery failure separately from failed file mutation.

Removal reads supplied references when its queued action starts. Presentation supplies accepted/draft profiles and open-game assignments; no temporary-process tracking exists. Name character/uniqueness checks belong to the import view. No catalogue or installation records are persisted. Detailed signatures and stacked function flows are in [the rework plan](../../../EngineInstallationReworkPlan.md#detailed-api).
