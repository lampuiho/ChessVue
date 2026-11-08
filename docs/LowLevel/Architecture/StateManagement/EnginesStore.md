# EnginesStore

## Purpose
Own UI-facing access to configured engine profiles, their transient discovered-option metadata, and the transient list of engine package folders together with package import and removal coordination.

## Public Interface
```ts
canInstallPackages(): boolean
refreshPackages(): Promise<void>
listPackages(): readonly IEnginePackage[]
getPackage(packagePath: string): IEnginePackage | undefined
browseEngineFile(startDirectory?: string): Promise<string>
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>
installPackage(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>
removePackage(packagePath: string, readReferences: () => readonly IEnginePackageUsage[]): Promise<void>
listConfiguredEngines(): IEngineRecord[]
getEngine(engineId: string): IEngineRecord | undefined
getOptionMeta(engineProfile: IEngineRecord | string): readonly IEngineOptionMeta[] | undefined
loadOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>
refreshOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>
validateAnalysisSelection(engineIds: string[]): void
```

The members appear in the order the store (`useEnginesStore`, store id `enginesStore`) returns them.

## Responsibilities
- read the accepted engine inventory for player and analysis selection flows
- cache protocol-neutral option metadata by engine profile id, and load or explicitly refresh it through `EngineRuntimeService`
- invalidate cached metadata when a profile's `entryPath` or `clientType` changes
- enforce duplicate, unknown-profile and four-engine checks for an analysis selection by profile id
- report whether this host supports managed engine package import and removal
- own the transient list of engine package folders and serialise discovery, import and removal through one package-work queue
- open the platform file dialog for an engine executable or entry script
- leave copied player-engine and analysis-engine assignment ownership to `GamesStore` once presentation has selected a reusable profile

## Runtime Gating Notes
- Engine-profile records are stored in the accepted settings snapshot (`analysis.engineInventory`) and edited through `SettingsStore.draftSettings`; `EnginesStore` reads them but does not write settings.
- `listConfiguredEngines()` returns `UserSettingService.getSettings().analysis.engineInventory`, the accepted inventory, not the settings draft. Profiles added in an unsaved draft become selectable only after Apply or Save. The read is not reactive: selection modals (`GameCreationModal`, `PlayerSelectionModal`, `AnalysisEngineSelectionModal`) read `SettingsStore.settings` inside the same computed so their list re-evaluates after an accepted settings change. **Why:** the inventory belongs to accepted settings, so a second store-held copy would need synchronising on every Apply, Save and Reset; reading through the layer-2 service keeps one source.
- Cached option metadata is runtime-only store state in a shallow-reactive map. It is neither added to `IEngineRecord` nor persisted with settings. Saved `IEngineRecord.options` values remain authoritative; discovery does not populate, validate or reconcile that map.
- `refreshOptionMeta(...)` records the profile's launch fields before awaiting `EngineRuntimeService.getOptions`, then caches the result only if the profile still resolves with the same `clientType` and `entryPath`. `getOptionMeta(...)` drops an entry whose launch fields no longer match. **Why:** a profile can be relinked while discovery is in flight; comparing the actual launch fields rejects metadata for the old target without a version counter.
- Analysis-runtime and player-move orchestration are owned by `GamesStore` through layer-2 services, not by this store.

## Package Actions
- `canInstallPackages()`, `refreshPackages()`, `listPackages()`, `getPackage()`, `browseEngineFile()`, `readArchive()`, `installPackage()` and `removePackage()` delegate file and package work to `EnginePackageService`. `canInstallPackages()` is a synchronous host capability (true for the browser platform target, false for NW.js desktop), not a storage-health or compatibility check. On desktop, discovery lists only the bundled Stockfish folder and `browseEngineFile()` selects an executable or script path in place.
- `_packages` is a shallow ref holding the last successfully discovered folder list; `listPackages()` and `getPackage()` are synchronous reads of it, so an empty list before the first discovery is not proof that storage is empty. No catalogue, installation record or remembered entry is persisted.
- All package work runs through `_queuePackageWork`, a settled promise chain. `refreshPackages()` shares the outstanding queued read with concurrent callers through the `_packageRead` owner; `installPackage()` and `removePackage()` drop that owner so a later refresh queues a fresh read after the mutation. **Why:** a discovery read queued before an import or removal could otherwise publish a list that predates the mutation; serialising through one queue and an explicit read owner avoids that without generation counters.
- Installation and removal rediscover after committing. If that rediscovery fails, they reject with a separate `PlatformError` (`refreshEnginePackagesAfterInstall` or `refreshEnginePackagesAfterRemove`) so presentation can distinguish "files changed but the list is stale" from a failed file mutation. `installPackage()` returns the new `packagePath` for Create profile.
- `removePackage()` invokes `readReferences` only when its queued turn starts. `EnginePackageDetailsView` composes accepted and draft game defaults and profiles from `SettingsStore` plus open-game player and analysis assignments from `GamesStore`. **Why:** references captured when Details opened could be stale by the time a queued deletion runs; supplying a reader keeps the check current while `EnginesStore` still does not call sibling stores.
- Engine-name character and uniqueness checks belong to `EnginePackageImportView`; cancellation and duplicate-start prevention of archive reads and installs belong to that view's `OperationOwner`. Detailed signatures and function flows are in the [engine installation rework plan](../../../ArchivedPlans/EngineInstallationReworkPlan.md#enginesstore-additions) and the [engine management UI design](../../../ArchivedPlans/EngineManagementUiDesign.md).

## Dependencies
- `UserSettingService`
- `EngineRuntimeService`
- `EnginePackageService` (imported from its module; it is not re-exported by the domain index)

## Scenario Coverage
- `SCN-GAME-02`
- `SCN-ANALYSIS-05`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`
- `SCN-ENGINE-03`

## Notes
- `EnginesStore` is intentionally inventory- and package-facing. It does not own live turn waiting, analysis refresh timing or engine-process orchestration.
- Current presentation consumes `listConfiguredEngines` and the package actions. `getEngine`, the option-metadata methods and `validateAnalysisSelection` remain available and tested but have no current view caller: the profile editor uses a name/value option table without discovery controls, and creation validation uses `getGameCreationError` from `GameCreationUtility`.
- `loadOptionMeta(...)` reuses current cached metadata, while `refreshOptionMeta(...)` always starts a temporary discovery runtime. Only a successful discovery replaces the cache. Option discovery is not part of the package-work queue.
- Metadata methods accept either a configured profile id or a draft `IEngineRecord`, allowing a profile editor to inspect an engine before that profile is persisted.
- Temporary discovery runtimes are owned and closed by `EngineRuntimeService`; the store retains only the copied metadata returned after closure.
- Presentation bridges `EnginesStore` profile selection into `GamesStore` assignment flows, so neither store calls the other.
