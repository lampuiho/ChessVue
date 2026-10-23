# Engine installation and profile rework

Prepared on 23 October 2026. Status: planned; no application implementation is included.

## Required behaviour

- Desktop supports native UCI executables and browser JS/WASM UCI engines together, including within one game's analysis seats and player assignments.
- Browser supports installed browser engines. Native engine profiles remain readable but unavailable on that host.
- Users can install additional browser engines, then create multiple profiles with different names and options from one installation.
- Bundled Stockfish is a default installed browser engine, represented by the same installation record and package format as user-installed engines. Its launch path has no Stockfish-specific branch.
- Assigned games retain copied names, options, protocol and launch configuration. Profile edits, package updates and profile deletion do not retarget existing games.

Planning assumption: install browser engines by importing a local package containing its manifest and assets. A URL installer can later feed the same package installation pipeline; a saved remote worker URL alone is not an installed package.

## Current boundaries and changes needed

| Current owner | Current behaviour | Required change |
| --- | --- | --- |
| [Engine contracts](../src/contracts/Engine.ts) | Profiles and assignments have `executablePath`, `clientType: uci`, protocol and options. | Separate installations from profiles; use an explicit launch descriptor in assignments. |
| [Platform selection](../src/platform/PlatformService.ts) | Selects one app host. | Keep host selection; compose both execution backends in desktop. |
| [EngineRuntimeService](../src/domain/EngineRuntimeService.ts) | Starts every engine through the host's one process manager. | Pass a typed launch descriptor to a manager capable of routing each launch. |
| [BrowserProcessManager](../src/platform/browser/BrowserProcessManager.ts) | Resolves `stockfish.js` specially and starts a worker URL. | Start installed package assets through the generic worker loader. |
| [Native process manager](../src/platform/nwjs/NwjsProcessManager.ts) | Starts native child processes. | Retain native mechanics behind the composed desktop manager. |
| [Shared UCI client](../src/platform/uci/UciEngineClient.ts) | Already accepts the private `IUciTransport` abstraction. | Retain one protocol state machine over both transports. |
| [EnginesStore](../src/state/EnginesStore.ts) | Reads profiles and caches discovered options. | Also expose installed engines, compatibility and owned installation actions. |
| [Settings persistence](../src/domain/UserSettingService.ts) | Stores profile JSON; defaults contain no profiles. | Persist installation references and seed a default profile on a fresh setup. |
| [Stockfish build assets](../build/StockfishAssets.ts) | Emits worker/WASM files and adds a worker failure boundary. | Emit an ordinary engine package and its manifest; move generic failure handling to the loader. |

The existing [store restructuring](StoreDependencyRestructuringPlan.md) has changes in progress in the working tree. Implement this rework against its final ownership boundaries, keeping engine installation independent of that call-wiring change.

Follow [AGENTS.md](../AGENTS.md) and the [archived cleanup ownership rules](ArchivedPlans/CodeCleanupPlan.md). The cleanup document referenced by AGENTS has moved to that archive. Use explicit actions and lifecycle owners, with no watchers or async invalidation counters.

## Data model

An **installation** identifies engine software and how to launch it. A **profile** names an installation and supplies configured option values. An **assignment** copies the selected launch configuration into a game.

```ts
export const enum EngineExecutionKind {
  Native = 'native',
  BrowserWorker = 'browserWorker',
}
export interface IEnginePackageReference {
  packageId: string;
  version: string;
  digest: string;
}
export type EngineLaunch =
  | { kind: EngineExecutionKind.Native; executablePath: string }
  | { kind: EngineExecutionKind.BrowserWorker; package: IEnginePackageReference };
export interface IEngineInstallation {
  id: string;
  displayName: string;
  protocol: EngineProtocol;
  launch: EngineLaunch;
  source: 'bundled' | 'user';
}
export interface IEngineRecord {
  id: string;
  displayName: string;
  installationId: string;
  options: IEngineOptionMap;
}
export interface IEngineSelection {
  displayName: string;
  protocol: EngineProtocol;
  launch: EngineLaunch;
  options: IEngineOptionMap;
}
export interface IAssignedEngine extends IEngineSelection {
  $?: IAssignedEngineRuntime;
}
```

- Keep `EngineProtocol.Uci`. Remove redundant `EngineClientType.Uci` from the new persisted contracts and select the protocol client by protocol. Execution kind belongs to the launch descriptor, independently of protocol.
- Package identity includes the digest of the manifest and declared files. Reimporting identical content resolves to the same installed package; a changed binary is a separate release even if its display version is unchanged.
- The installation owns protocol and launch configuration. Profiles do not duplicate either. `IEngineSelection` is the resolved input passed to game creation, assignment and option discovery.
- `EnginesStore` resolves profile plus installation for selection. `GamesStore` copies the resolved selection into a new assignment; it never looks up a sibling store or retains the editable profile object. Clone nested launch/package descriptors and option maps at this boundary.
- Saved assignments contain the complete native launch path or exact package reference. They do not depend on a profile or installation row remaining present. Browser package bytes remain an external installed dependency, as a native executable does today.
- `source` records provenance for display and default seeding only. Runtime launch, discovery, stop and retry never branch on it.
- Keep installed, supported-on-host and running/failed as separate concepts. Derive availability from installation presence, package requirements and host capabilities; do not persist a second copy of runtime availability.

## Browser package format and loading

Import a ZIP package containing `engine.json` and declared files. The same manifest and files are emitted for bundled packages. The manifest includes schema version, package id, display version/name, protocol, worker entry, asset paths/media types/digests and licence/source notices.

The first package contract supports classic, single-threaded UCI workers using string messages, matching the existing browser engine. Required worker capabilities must be declared and checked before installation is published. Module workers and threaded WASM require a separate extension to this contract.

Use a package-owned entry wrapper where the vendor needs startup configuration. The generic loader provides an asset-path-to-URL map before importing that entry. Packages must resolve dependencies through this map rather than assuming a deployed directory exists. For vendor workers that locate resources through the worker URL fragment, support a manifest-declared ordered list of asset paths to encode into that fragment. Stockfish's WASM location is expressed through this package metadata, with no engine-name test in application runtime code.

The loader reads stored assets, creates correctly typed Blob URLs and starts a bootstrap worker which installs the generic startup failure boundary, exposes the asset map and imports the entry. Browser Blob workers inherit their creator's origin; relative imports resolve against the worker entry URL, which is why package dependencies need an explicit mapping. See the [Worker constructor](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) and [importScripts documentation](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

An asset lease owns every created URL until the worker has terminated. Release the whole lease on failed startup, explicit stop, restart, crash and app disposal. Never persist Blob URLs, `Worker` objects or leases. A package's original source URL, when present, is provenance rather than its runtime dependency.

This format requires a conforming package or package-local wrapper. It does not claim that an arbitrary vendor `.js` file with implicit relative imports is sufficient. Prove the asset-map and fragment mechanism against real Stockfish before implementing the remaining layers.

## Installation storage and lifecycle

Add a platform `IEngineInstallationAdapter`, reached from state only through a layer-2 `EngineInstallationService`. It owns installation records, staged package assets and committed package assets; keep the existing text-document `IStorageAdapter` focused on settings and games.

| Host | Package storage | Execution support |
| --- | --- | --- |
| Browser | IndexedDB records and binary assets, committed transactionally | Browser worker packages |
| Desktop/NW.js | An app-owned engine directory under the app data root, with staging directories and atomic publication | Native processes and browser worker packages |

IndexedDB supports significant structured data including files and Blobs, making it suitable for the browser packages rather than putting WASM in the existing localStorage JSON filesystem. See the [IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Storage loss or a failed write must produce an unavailable installation or failed install with a repair action; no profile silently switches to another engine.

`EnginesStore` coordinates the installation steps through layer-2 services. `EngineInstallationService` does not call `EngineRuntimeService`, and neither service looks up a store.

1. A user action creates an installation operation with an abort controller. Prevent duplicate starts for the same package operation.
2. Read the archive; validate its schema, declared assets, digests, worker requirements and contained paths. Stage complete bytes before publication.
3. Obtain a temporary resolved selection from the staged package. Use `EngineRuntimeService` for a bounded UCI initialisation/options probe, then fully close that temporary runtime.
4. Commit the complete installation through `EngineInstallationService`. Publish it to the store only after the adapter commits successfully. Return discovered metadata separately from configured profile options.
5. On failure or cancellation, settle the temporary runtime and remove staging data. An already-issued commit finishes with its result handled; cancellation must not leave the UI reporting an unknown partial installation.

Staging work and its temporary runtime have one explicit operation owner. Modal dismissal, route exit and app disposal cancel uncommitted work and await cleanup. Interrupted staging is reconciled at the next installation initialisation. The committed installation catalogue is authoritative; failed publication must not leave a selectable record.

Native installation means registering an existing executable, without copying or managing that executable. Its path is copied into assignments as today. Browser installation means retaining all package assets, so subsequent engine starts do not redownload them. This does not add offline caching for the application shell.

## Default installed engine

- Convert `StockfishConfig` and the build asset emitter into a bundled package manifest plus its files. Keep the dependency pinned and include the existing licence/source notices.
- Initialise the installation catalogue before restoring games. On a fresh catalogue, install bundled Stockfish through the same validation, staging and publication path used for imports. Record completion durably so reloads do not duplicate installations.
- A clean settings setup receives one ordinary Stockfish profile referring to that installation. Existing settings migration preserves existing profile choices rather than inventing extra profiles.
- The default installation can be used by copied and newly created profiles exactly like an imported installation. Removing a profile leaves it installed.
- Explicit uninstall records the user's removal so startup does not reinstall it. Provide an explicit restore-default-engine action using the packaged source. Missing/corrupt assets are reported as repairable instead of being confused with intentional removal.
- Settings reset restores the default profile and ensures its package is installed, while retaining other installed packages. Resetting preferences is not package deletion.
- App upgrades never overwrite a referenced package or silently retarget profiles or assignments. A new bundled release is a separate package; existing installed bytes remain usable until explicitly removed.

If initial seeding fails, complete application startup with a recoverable installation warning and leave local play available. Report the default engine as unavailable and offer Retry; do not hold the whole app on a loading screen.

## Runtime composition

Keep the host-wide `PlatformService`, but make its engine services support multiple execution kinds.

```text
EnginesStore -> EngineInstallationService -> installation adapter
            -> EngineRuntimeService      -> temporary installation probe

Selected profile + installation -> IEngineSelection
  -> GamesStore copies IAssignedEngine
  -> EngineRuntimeService
       -> ProcessManager.spawnProcess(engine.launch)
            native        -> native process + stream transport
            browserWorker -> package asset lease + worker transport
       -> EngineClient(engine.protocol)
            shared UCI state machine -> registered IUciTransport
```

- Change `IProcessManager` to accept a typed launch descriptor instead of interpreting a location string. Carry cancellation through asset preparation/startup so a cancelled owner cannot launch a replacement worker later.
- Compose a desktop process manager with both native and worker backends. Browser composes only the worker backend and rejects native launch explicitly.
- Maintain a platform-owned process registry which binds each opaque handle to its actual lifecycle owner and `IUciTransport`. Stop, validity checks, restart and disposal use that registered owner rather than parsing handles or consulting a mutable profile.
- Extract the existing native stream adapter from `NwjsUciEngineClient` into transport construction. Register it beside `BrowserUciTransport`; the UCI client resolves both through the same transport seam.
- Keep one UCI session implementation and the existing stop acknowledgement, pending player-move, ponder and failure semantics. Engine search ownership and game legality checks stay with their current owners.
- Keep worker execution in the browser environment on NW.js. Verify the packaged application does not enable Node integration in these workers; NW.js exposes that integration through `--enable-node-worker`. See [NW.js command-line options](https://docs.nwjs.io/References/Command%20Line%20Options/).
- Every running assignment retains its own process/worker, even when several profiles share one package. Share immutable installed files, not live engine sessions.
- Change temporary option discovery to consume a resolved selection. Cache discovered metadata against launch identity and protocol, so retargeting a profile cannot reuse another installation's option declarations.

## Settings and selection flows

Keep one Engines settings category with two clear lists: installed engines and configured profiles.

- Installation actions: Install browser engine, Register native engine on desktop, Remove installation, Restore default engine and Retry failed installation. Show engine version, execution kind and availability.
- Profile actions: Add, Copy, Edit and Delete. The profile editor selects an installed engine, then edits display name and options. Raw worker URL/path entry moves out of profile editing.
- Profile edits retain the current settings draft and Apply/Save/Discard behaviour. Installation actions are explicit operations which commit immediately and show their own success/failure. Discarding a profile draft does not roll back a completed installation.
- Installing software does not silently create a configured profile. Offer an explicit Create profile action after successful import; first-run default seeding is the documented exception.
- Removing a profile never removes shared package files. Block uninstall while a committed profile or an open game's assignment uses that installation/package. The UI coordinates the checks from the owning stores without store-to-store lookups; the platform adapter also rejects deletion while a live asset lease exists.
- Closed saved games keep their launch reference and can report a missing package after uninstall. Reinstalling identical content repairs that dependency without changing the game. New package versions never substitute automatically.
- Reject Apply/Save if a draft profile refers to an installation removed since the draft was opened. Keep the draft and show the repair action.
- New-game, player and analysis selectors show host compatibility and missing-package reasons. Prevent new unsupported selections while retaining the stored profile and existing assigned snapshot.
- Replace path-specific rendering and validation, including `PlayerSelectionModal`'s `executablePath.trim()` check and paths shown by `AnalysisEngineSelectionModal`. A valid package reference is sufficient for browser launch.
- Use global classes in `src/assets/styles/settings.css` and existing primitives. New production components remain `.vue`; install/loader TypeScript belongs outside `src/components`.

Installation UI owns its picker, progress and errors for the actual operation. Dismissal and navigation must not deliver a late result into another dialog. Once publication starts, preserve its completion and refresh the catalogue from that outcome even if its initiating dialog has closed.

## Persistence and migration

Introduce version 2 for settings and saved games, with a separately versioned installation catalogue and package manifest. Leave session/layout document versions alone unless their own shapes change.

- Convert on read and write version 2 at the next normal save. Keep explicit version-1 parsers; never let a new strict schema discard old engine fields before migration.
- Update both deserialisation paths: `UserSettingService` currently parses settings directly, while `SerializationService` also exposes settings parsing. Both use the same pure migration utilities outside the services, avoiding same-layer calls and inconsistent recovery.
- Pure migration returns converted data and any required installation-registration intents; it performs no storage writes or engine starts. Startup coordinates registration through `EnginesStore` before workspace restore. Retain unresolved source metadata until registration commits, so saving after a failed migration cannot lose the original engine location.
- Migrate recognised native locations into registered native installations and copy their launch paths into saved assignments. Map the exact `stockfish.js` alias to the bundled package reference.
- Preserve arbitrary old worker URLs and ambiguous locations as unavailable legacy entries requiring Install/Relink. Their dependent asset sets cannot be reconstructed reliably from one URL. Keep the original location and options in a dedicated compatibility representation; do not fabricate a package digest, infer execution solely from the current host or silently point them at Stockfish.
- Compatibility entries cannot reach a launcher until explicitly resolved. Give the version-2 schemas a discriminated unresolved-reference form and migrate it only through the Relink action. This is a persistence repair state, not a third executable backend.
- Reading a saved game remains a pure data conversion; it must not install software. Resolve compatibility/package presence when inserting/restoring the workspace, preserving valid moves, clocks and recorded analysis if an engine is unavailable.
- Catalogue initialisation and known-alias migration must agree on the exact bundled package reference before game restore. Keep a migration mapping for the currently bundled alias target so a later app update does not reinterpret an already migrated assignment.
- Settings/game JSON contains metadata and package references only. Exporting a game does not embed engine binaries; importing on another host may require the matching package or native executable.
- Preserve unknown/unsupported inputs with an actionable recovery result, rather than resetting the whole settings file because one engine cannot yet be installed.

## Implementation sequence

| Step | Deliverable | Completion evidence |
| --- | --- | --- |
| 1. Prove package loading | A real Stockfish package using the generic Blob bootstrap, asset map/fragment and failure handling on browser and actual NW.js. Include a second small worker package with an auxiliary asset. | Both load from stored bytes after reload; discovery and legal move search succeed; no special Stockfish resolver remains in the prototype. Confirm the supported package ABI before proceeding. |
| 2. Contracts and compatibility | Installation/selection/launch/package schemas, version-2 readers/writers, common pure migration helpers and updated fixture factories. | Existing settings/games remain readable; unresolved legacy sources survive round trips. |
| 3. Installation lifecycle | Binary adapters, catalogue, staging/commit/disposal, import picker and owned `EnginesStore` actions. | Complete installs survive restart; failed/cancelled/interrupted installs never become selectable; identical imports deduplicate. |
| 4. Mixed execution | Composed desktop process manager, common transport registry and launch-based runtime entry points. | Native and worker assignments run concurrently; isolated stop/restart/crash and cancellation settle correctly. |
| 5. Default package and startup | Package-producing build, default seeding, startup-before-restore ordering, explicit repair/reset behaviour and removal of runtime alias handling. | Fresh setup, subsequent reload, default uninstall, repair and app/package upgrade follow the same installation rules. |
| 6. Settings and assignments | Installed/profile lists, profile installation picker, resolved selection inputs and copied assignment payloads. | Draft save/discard, copy/edit/delete, uninstall references and all player/analysis selectors work on both hosts. |
| 7. Acceptance and documentation | Focused regression suites, browser journeys, real NW.js acceptance and architecture documentation. | Record actual results; distinguish mocked protocol coverage from native host evidence. |

Keep the working tree runnable at each integration boundary. Do not enable the new profile writer until its installation resolver, runtime path and migration reader are available. Remove transitional readers/aliases only after all callers and fixtures have moved; retain supported version-1 deserialisation.

## Verification

Tests should establish behaviour across the new boundaries, not duplicate individual mapping functions.

| Area | Required scenarios |
| --- | --- |
| Mixed desktop runtime | Native player plus worker analysis; worker player plus native analysis; both analysis kinds in one game; independent stop/restart/crash; two profiles sharing installed files with independent runtimes. |
| Browser compatibility | Installed worker runs; native profile remains visible/unavailable; imported native assignment does not prevent opening the rest of a game. |
| Real package assets | Built-in and imported JS/WASM work from installed bytes after reload with original download requests blocked; auxiliary assets resolve through the package contract; missing/corrupt WASM settles with an error. |
| Installation ownership | Duplicate install, picker cancellation, cancellation during asset reads/probe, dismissal/navigation, failed publication, quota/write failure, interrupted staging and app disposal. |
| Defaults and updates | Fresh default installation/profile, no duplicate seeding, intentional uninstall survives reload, restore/reset, installation failure during startup and immutable old package after update. |
| Profiles and persistence | Two profiles for one installation; edits/deletion do not alter assigned games; blocked uninstall, stale draft reference, v1/v2 round trips, alias/native/ambiguous migration and missing-package repair. |
| Existing engine behaviour | Option discovery cleanup, player turns, pondering, pause/deferred move, multi-engine analysis, supersession, restart and per-engine failure isolation. |

Update the existing engine runtime/platform/store tests, settings and serialization tests, `journeys/data/EngineProfile.ts`, journey bootstrap and `e2e/support/EngineInventory.ts`. Replace path-entry assumptions in the real browser engine journeys with installation and profile actions. Run real installed Stockfish as well as deterministic protocol fixtures.

Run `npm run check:code` after relevant implementation changes, focused Vitest suites, affected Playwright journeys and `npm run build`. Actual NW.js acceptance is required for mixed desktop execution; browser tests and NW.js mocks do not establish that result. This planning-only change does not claim execution of those implementation checks.

Update the high-level engine runtime/settings/build/persistence contracts, low-level engine data interfaces, platform process/client contracts, runtime ownership flow, store contracts and Settings component documentation with their implementation steps. Record the final package format and authoring instructions alongside a distributable example package.
