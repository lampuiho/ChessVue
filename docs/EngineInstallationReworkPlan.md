# Engine targets, browser packages and profiles

Prepared on 23 October 2026; revised on 25 October 2026. Status: self-contained Blob-loader correction implemented and verified in the working tree. See the [UI specification](EngineManagementUiDesign.md) and [clickable preview](design/EngineManagement.html).

The [NW.js spawned-process correction](ArchivedPlans/NwjsProcessOwnershipFixPlan.md) and [browser engine dependency correction](ArchivedPlans/BrowserEngineDependencyFixPlan.md), including native inheritance, are implemented. On 25 October 2026 the user authorised replacing the stored-file service-worker mechanism with the tested Blob bootstrap and local asset mapping. The user also required one self-contained loader, normal Worker lifecycle cleanup, and removal of the separate serving classes and entry. This document records that implementation without changing the agreed runtime APIs, package model or UI.

Both process managers already return an IProcess reference, stored in IAssignedEngineRuntime.process. NW.js returns the original spawned process with UTF-8 output streams. BrowserProcessManager returns markRaw(new BrowserWorkerProcess(worker)); that wrapper privately adapts Worker commands, output and managed closure to IProcess. Its constructor takes only the Worker. The manager's _processes set exists only for disposal, not reference lookup.

NwjsUciEngineClient and BrowserUciEngineClient already inherit UciEngineClientBase. The base owns UCI operations, sessions and process I/O; in the completed baseline, subclasses implement only _isProcessOpen and _getProcessExitDetail. Each platform store constructs its plain client with markRaw and returns the same instance through IEngineClient. Preserve this composition and direct process ownership: no per-client Pinia store, binding facade, transport resolver or process registry is required. NwjsUtility retains native host access/liveness; shared line I/O belongs to the base.

The package rework changes the registered client enum and launch-path selection described below. It does not reintroduce handles or redo either completed correction, and adds no EngineRuntimeService public API. Existing package, profile and UI decisions remain unchanged.

The app has never been released. Update the current schemas and fixtures directly, keeping the initial schema version. Do not add migrations, compatibility readers, old-field conversions or runtime aliases.

The [detailed API](#detailed-api) and [function flows](#function-flows) below describe the additions and changes required by this rework. Existing EngineRuntimeService APIs and lifecycle remain defined by the [runtime ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md); they are not being redesigned here. This plan retains the reviewed API and stacked function-flow design alongside implementation evidence.

## Architecture correction: explicit changes for review

The process manager owns its private loader and the processes it creates. WorkerScriptLoader is self-contained implementation support: it reads stored files, creates their Blob URLs and bootstrap, creates a normal Worker and makes termination release that Worker's URLs. No serving object, service-worker registration, global listener or separate execution entry is retained.

| Change | Implementation delta |
| --- | --- |
| Keep private shared implementation | BrowserProcessManager and NwjsProcessManager independently derive WorkerProcessManagerBase. No concrete manager calls another concrete manager. |
| Keep the existing desktop owner | NwjsProcessManager remains the single class configured by EngineClientType for native/Worker bindings. Its native process method bodies remain unchanged. |
| Replace the old utility | Rename src/utility/StoredWorkerUtility.ts to src/utility/WorkerScriptLoader.ts and its configuration/file types accordingly. EnginePackageService retains a storage-only instance; each manager owns its own loader. |
| Encapsulate Worker loading | createWorker reads a stored package atomically, maps original assets to Blob URLs and imports the original entry through a generated bootstrap. It returns a standard Worker whose terminate releases its own URLs. |
| Remove serving files | Delete src/utility/StoredWorkerServer.ts, src/utility/StoredWorkerEntry.ts and build/StoredWorkerAssets.ts, their tests and Vite wiring. Remove serviceWorkerPath from configuration. The earlier platform service-worker entry and separate desktop Worker manager stay deleted. |
| Simplify spawn/disposal | Remove _packageRegistration and _registerPackageServiceWorker. spawnProcess resolves the host URL, awaits createWorker, checks manager lifetime and wraps the Worker. Disposal cancels pending reads and kills this manager's Workers; their normal termination releases their assets. |
| Load external desktop scripts | The same loader uses a Blob bootstrap for file URLs, resolving importScripts/fetch/XHR against the original file entry. This avoids constructing a Worker directly from an external file URL. No flags, localhost server or copied engine package. |

The loader imports no app configuration, engine contracts, domain services, platform implementations or stores. Its generated bootstrap runs only inside the dedicated Worker it creates. Original engine JS/WASM bytes and filenames are preserved. No public process/runtime API, persistence schema, catalogue, migration, protocol or UI change accompanies this correction.

## Questions to answer before implementation

Decisions confirmed by the user on 24 and 25 October 2026:

1. **Included engine:** load directly from app-shipped package files. Do not copy it into browser package storage. It appears as an ordinary available package/default profile and uses the matching engine client.
2. **Import destination:** the installed engine name is its folder name. The import view has an Engine name input with folder-name character validation. The name is separate from any profile name and the vendor's archive filename.
3. **Uniqueness:** installed engine names must be unique. The frontend checks its loaded engine list and blocks a duplicate name. These answers do not authorise a separate in-place replacement workflow.
4. **Versions:** no separate version field or upstream name/version discovery. Display the folder name as the engine name. Users may include a version in that name themselves.
5. **Stored-script loading:** use the tested Blob bootstrap and local asset mapping. This supersedes the earlier service-worker choice; the static app host receives no imported engine files.
6. **Removal protection:** check accepted profiles, draft profiles and open-game assignments only. Temporary engine operations do not add a removal guard or tracking subsystem.
7. **Reusable library:** a generic capability for loading locally stored JavaScript and assets in Workers is valid private utility support. It must contain no chess-engine policy or engine-specific dependency.
8. **Desktop manager:** no NwjsWorkerProcessManager; NwjsProcessManager can derive private shared implementation.
9. **Local ownership:** the process manager owns a private WorkerScriptLoader. The loader returns a Worker that owns its Blob URLs; separate serving objects and global listeners are removed.
10. **Disposal:** stopping a process releases that Worker and its URLs. Manager disposal cancels pending reads and stops its live Workers. There is no registration to unregister.

The listed questions have been answered. The user explicitly authorised the Blob-loader correction on 25 October 2026. Long-wait handling and retry UI remain deferred.

## Installed engine names

Use the Engine name as one folder component, preserving the entered name in storage and display. The frontend import view owns both name-format and uniqueness validation, using its already loaded engine list, and enables Install only for a valid, unique name after successful folder discovery. The view awaits its own discovery action on direct entry and keeps Install disabled during loading or after discovery failure; an empty/stale list is not evidence that a name is available. EnginesStore and EnginePackageService receive the validated name without repeating either check. The list includes the built-in folder, whose name is also unavailable. Profile labels remain independently editable.

Reject an empty/whitespace-only name, . or .., path separators, control characters, the characters `< > : " / \ | ? *`, and a trailing space or dot. Also reject reserved device names such as CON/NUL/COM1/LPT1, including their extension forms. Unicode names, spaces within names, hyphens and version text remain usable. Compare engine names without case differences so Stockfish and stockfish do not become duplicate-looking entries. These validation rules follow [Windows folder-name constraints](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) while keeping the user-supplied name.

## Stored-script loading options

The selected mechanism is a Blob bootstrap with a local asset URL map. For a stored entry, WorkerScriptLoader reads that package's original files from IndexedDB in one readonly transaction, creates correctly typed Blob URLs and maps their virtual package URLs to those local resources. The bootstrap gives the entry its original virtual location and resolves importScripts, fetch (strings, URLs and Requests) and XMLHttpRequest.open against that location. Original scripts are imported without rewriting their bytes. Query/hash variants of a mapped asset resolve to that same stored file.

The creating page may be hosted as a static HTTPS site, including a GitHub Pages project subpath. Engine files stay in the browser. There is no user-run server, engine upload, service-worker registration, activation/control wait or build-time serving entry. Ordinary bundled/app URLs still use an ordinary Worker. Desktop external file URLs use the same bootstrap with direct file resource URLs and no IndexedDB read.

Every call creates an independent Worker and independent asset URLs. Its normal terminate API releases those URLs. Construction failure releases already allocated URLs; cancellation is checked before allocation. The manager checks lifetime after awaiting the loader and terminates a Worker delivered after disposal before returning a process. Normal process stop, observed Worker errors and manager disposal reach this same termination path.

The bootstrap supports the tested classic single-Worker engines, including Stockfish lite with WASM and Lozza. It does not add support for module imports or nested Workers; the tested nested-Worker fixture fails under Blob loading. Do not describe arbitrary multithreaded engine builds as supported. Package-specific URL manipulation may still impose engine limitations. No timeout, readiness callback, automatic slow-start cleanup or retry UI is added. Existing UCI initialisation and the native Worker message queue remain responsible for startup commands.

## Scope

Enable browser profiles to select and load other engines using their supplied entry files. Reuse the existing initialisation, getOptions, analysis/player operations and cleanup. Package import stores files; it does not launch engines or classify their capabilities. Runtime lifecycle policy is unchanged.

### Implementation boundary

**Implementation must change only what this plan explicitly specifies as a change. All unmentioned APIs, behaviour, data contracts, persistence and architecture must remain unchanged.** A call shown for context does not authorise changing its API or implementation. Do not refactor surrounding code or add unrelated work. If implementation requires an additional API, behaviour or architecture change, raise it with the user and wait for their decision before adding it to the plan or code.

EngineRuntimeService retains every existing public method, name, signature, parameter, return contract and error/cancellation/lifecycle behaviour. No new runtime API, package operation or preparation step is added to its public surface. Its only implementation edits are the existing launch-data and platform-binding substitutions required by this plan:

- _createAssignedEngine copies entryPath instead of executablePath and stops copying the removed protocol field.
- _initialiseEngine passes engine.clientType to the existing process-manager lookup and engine.entryPath to spawnProcess, including its existing InvalidProcessHandle retry.
- _assertProcessOpen, isRuntimeAlive and _releaseEngineProcess pass engine.clientType to their process-manager lookups.

Keep their existing branching, sequencing, ownership, cancellation, error handling and cleanup intact. The client lookup already uses clientType and needs no API change. Option discovery, analysis, player turns, stop and restart continue through their existing callers and lifecycle. These constraints remain in force during implementation.

The review corrections below additionally specify manager-owned preparation/disposal, private desktop file-URL resolution, platform-scope Worker-manager disposal and frontend discovery eligibility. They add no public engine/runtime operation or persisted state. The shared UCI base still changes only for its registered enum; both subclasses retain their existing two hooks and inherited initialisation. All native protocol/client behaviour is retained.

stopProcess becomes idempotent in both process managers: an already-stopped resource returns successfully. Remove its assertProcessOpen call, retaining the existing live-process exit wait and kill sequence. assertProcessOpen remains available for callers that require a running process. This changes no method signature or EngineRuntimeService implementation beyond the substitutions listed above.

## Agreed model

Desktop profiles point directly to an executable or the entry file inside a browser engine package, wherever the user keeps it. Browse uses the ordinary file dialog: navigate into the unpacked folder and choose the actual executable/script. There is no desktop installation, registration or engine catalogue.

- Browser import stores the supplied package files, preserving their relative layout. Discover imported packages by reading those folders, without separate installation records.
- Require neither a fixed entry filename nor a new manifest. Upstream archives do not generally contain a ChessVue manifest. Do not generate one during browser import or modify desktop folders.
- The engine name comes from its folder, not upstream package metadata. Ask for the entry/interface explicitly; never guess the first JavaScript file or assume an npm `main` is a Worker.
- Proposed engine APIs and data contracts stay generic across hosts: refreshPackages, listPackages, getPackage, browseEngineFile and IEnginePackage. browseEngineFile(startDirectory?) chooses an executable or entry-script file and returns its path, delegating to the existing IStorageAdapter.showOpenDialog contract. Capability checks expose available operations. EnginePackageService owns browser package storage directly; existing platform implementations handle file pickers and process/Worker loading. No desktop/browser API families or host-discriminated DTOs.
- `EngineClientType` remains the single implementation selector. Remove the unused engine `protocol` field and `EngineProtocol` as part of the rework.
- Bundled Stockfish uses an ordinary package folder and a default profile naming its actual supplied entry file. It uses the same loader as user packages.
- Each assignment copies the profile's entry path, client type, name and options. Profile edits/deletions do not retarget existing games.

Follow [AGENTS.md](../AGENTS.md), the [cleanup ownership rules](ArchivedPlans/CodeCleanupPlan.md) and [store dependency boundaries](ArchivedPlans/StoreDependencyRestructuringPlan.md). Use explicit actions and lifecycle ownership, no watchers or async invalidation counters. State reaches platform capabilities through layer-2 services; stores do not look up sibling stores.

## Upstream interfaces and files

Documentation/source checked on 23 October 2026; entry files rechecked on 24 October. These are API findings, not full runtime acceptance results.

| Engine/build | Supplied entry and interface | Consequence |
| --- | --- | --- |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js#browser) | Example: `stockfish-19-lite-single.js`, matching WASM beside it; Worker `postMessage` and string message events | Fits `UciWorker` without renaming or an extra wrapper. |
| [Lozza](https://github.com/op12no2/lozza#basic-use-in-a-browser) | `lozza.js`; same Worker string interface | Independent engine using the same client. |
| [tomitankChess](https://github.com/tomitank/tomitankChess#usage) | `tomitankChess.js`; same Worker string interface | Another supplied filename, same app-facing implementation. |
| [Fairy-Stockfish WASM](https://github.com/fairy-stockfish/fairy-stockfish.wasm/blob/nnue/src/emscripten/public/package.json) | Package includes `stockfish.js`/`stockfish.wasm`; module [postMessage/addMessageListener API](https://github.com/fairy-stockfish/fairy-stockfish.wasm/blob/nnue/src/emscripten/preamble.js) | Requires a matching module client or explicit adaptation, rather than treating its helper workers as the engine entry. |
| [Lichess stockfish-web](https://github.com/lichess-org/stockfish-web#run-locally-on-node) | Build-specific entry, e.g. `sf_19.js`; [uci/listen module API and NNUE loading](https://github.com/lichess-org/stockfish-web/blob/master/stockfishWeb.d.ts) | Different module interface despite also speaking UCI. |

`UciWorker` names the common string-message interface, not an engine brand or filename. Another implemented interface gets another member in the same enum. JS versus WASM, source provenance and display name do not select implementations. A common app interface does not imply common package metadata or directory names.

Verify the selected implementations with normal engine startup, option discovery, analysis and play during development; do not add those checks to the installation/profile workflow. The [Lozza fork originally examined](https://github.com/namanthanki/lozza/blob/main/README.md#limitations) documents missing `stop`; that finding is build-specific, not a universal Lozza guarantee. Preserve the existing stop/drain contract.

## Profile and discovery contracts

```ts
export const enum EngineClientType {
  Uci = 'uci',
  UciWorker = 'uciWorker',
}
export const enum EngineInstallationSource {
  Bundled = 'bundled',
  User = 'user',
}
export interface IEngineLaunch {
  clientType: EngineClientType;
  entryPath: string;
}
export interface IEngineRecord extends IEngineLaunch {
  id: string;
  displayName: string;
  options: IEngineOptionMap;
}
export type IEngineSelection = Omit<IEngineRecord, 'id'>;
export interface IAssignedEngine extends IEngineSelection {
  $?: IAssignedEngineRuntime;
}
export interface IEnginePackage {
  packagePath: string;
  displayName: string;
  source: EngineInstallationSource;
  files: string[];
  warning?: string;
}
```

`entryPath` is the actual launch target: native executable for Uci, supplied browser entry script for UciWorker. Desktop accepts user paths or app-relative bundled paths. Browser uses virtual file paths in its package filesystem. Other future clients interpret their entry according to that implementation. There is no additional execution-kind enum or protocol selector.

`IEnginePackage` is a generic transient folder-discovery result, not a persisted record or a browser-specific type. displayName is the folder name. Derive source from the app-shipped/user storage namespace. Source uses `EngineInstallationSource` and never selects the runtime. No package name/version parsing is needed.

The profile stores launch information because the user chose that target. Imported package storage holds only package files. There is no installation id, catalogue, saved entry-selection registry or generated loading descriptor. Several profiles can target one script with different options, or different builds inside the same folder.

Copy clientType/entryPath fields and a fresh options map into assignments. IAssignedEngineRuntime.process?: IProcess is the existing runtime-only process reference and remains unchanged; do not persist it or introduce another process field. Keep the existing option-cache invalidation by client type/path, removing protocol from the comparison. Missing files use the existing runtime error handling; saving settings and assigning profiles gain no file checks.

## Package reading and entry selection

Preserve the upstream folder structure, script names and auxiliary resources. Browser import accepts the archive's actual layout; desktop users may extract it anywhere and point a profile at the executable/package entry. No required `assets` subdirectory or renamed entry is introduced.

1. Display the folder name and actual files, without reading package name/version metadata.
2. Ask the user to select the intended entry and implemented interface. Do not choose a helper worker merely because of its filename. Unsupported module APIs remain unsupported until the matching client/adaptation exists.
3. Save the explicit entry, implemented client type, profile name and configured options. Existing option discovery continues through getOptions.
4. Launch that entry with its required assets through the existing runtime path when the engine is used.

On desktop, selecting a target writes no package files. Browser import stores files without choosing an entry or client type. Create profile is a separate action that selects the entry and interface from the stored files. A package may have no profiles.

The loader must preserve or explicitly support the build's relative imports, WASM/NNUE resolution, MIME types and host requirements. Do not assume every vendor entry accepts an app asset-map bootstrap or that Blob workers inherit a package directory. Verify actual Stockfish and an independent Worker through the selected loading mechanism. See [Worker construction](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) and [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

Load app URLs directly. The self-contained loader uses a Blob bootstrap for stored packages and desktop file entries, preserving original entry/asset bytes and resolving relative resources. The process manager owns each Worker process and its closure. Never save process/Worker objects, Blob URLs or picker handles in profiles.

## Retrieval without a catalogue

| Target | Retrieval | Persisted data |
| --- | --- | --- |
| Desktop executable | Use the profile's exact executable entry path | Profile/assignment launch data and options |
| Desktop browser engine | Use the profile's supplied script path; resolve its required neighbouring/package resources | Profile/assignment launch data and options; no copy or registration |
| Bundled desktop engine | Same file reader and client, using the default profile's actual entry | Ordinary default profile |
| Imported browser package | Enumerate package directories/file keys; display the folder name | Original package files and relative layout |
| Browser engine profile | Resolve its exact virtual script path inside the discovered package folder | Profile/assignment launch data and options |

Keep the dedicated `chessvue-engines` IndexedDB database and files keyed by `[packagePath, relativePath]`. The generic library treats those components as an opaque root and relative path; engine meaning stays in EnginePackageService. Package-root keys define folder boundaries. Enumerate distinct roots and their filenames without loading WASM/NNUE bytes. A successful import contains files, so no independent folder/installation record is required. Add the app-shipped bundled folder to discovery without copying its files into storage. App-shipped/user roots determine the source enum. See the [IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Do not create an installations object store, catalogue singleton, generated package manifest or remembered-entry table. Desktop has no managed user-engine root to scan. Package discovery and import do not start engines. Existing option requests use getOptions; normal engine use retains existing readiness/error handling.

| Boundary | Responsibility |
| --- | --- |
| `EnginePackageService` | Own engine folder discovery/projection, import/removal and reference rules, using private generic library file operations. Add bundled build-declared files; no desktop package implementation or new platform interface. |
| `EnginesStore.refreshPackages()` | Own/share discovery through the same API when the package list is opened and after explicit import/removal/Refresh actions. Desktop paths have no managed inventory to enumerate. Preserve profile drafts; no host checks, watchers or polling. |
| Profile/import target action | The existing file dialog returns a chosen file path; the profile form copies it into entryPath. Stored package files are selected directly from IEnginePackage.files. Archive input uses IEnginePackageFile (filename and original bytes), not File/Blob or a native picker handle. Validate archive paths/files through layer-2 services and own file-operation cancellation. |
| Assignment | Copy the selected profile through the existing game/player/analysis handlers. No new resolution API or preflight. |
| Asset preparation | The concrete manager resolves the exact entry URL and owns the Worker process and private loader. WorkerScriptLoader owns stored-file reading, asset mapping, bootstrap construction and Worker creation; the returned Worker's terminate owns URL cleanup. Derive the package boundary from its virtual path, not a registry id. |

```text
Desktop profile -> executable entry -> native client/process
Desktop profile -> supplied JS entry -> matching browser client
Browser profile -> stored virtual entry -> same browser client
```

## Browser import and defaults

Only browser hosts need import/removal. EnginesStore coordinates engine file operations through EnginePackageService; its private generic library reads and writes the existing IndexedDB files store. EngineRuntimeService retains its existing operations for engines in use and temporary option discovery.

1. Collect the Engine name and validate its characters/uniqueness. An explicit import owns its picker and file operation; prevent duplicate starts.
2. Decode the archive and validate its paths/files. No entry/interface choice or generated manifest is required.
3. Publish all original files atomically in one IndexedDB transaction, preserving relative paths. No metadata/catalogue publication follows.
4. Refresh discovery. Failed/cancelled reads publish nothing. Settle an issued publication even if the initiating UI closes. Done retains files only; Create profile opens the separate Settings draft flow.

Cancel/settle superseded file reads before replacement work. Serialise conflicting publication/discovery. Browser package removal checks committed/draft profile entries and open-game assignments inside the folder. A draft-only profile deletion still blocks removal until Apply. Removal never touches desktop files or automatically rewrites profiles/games.

The build supplies Stockfish's original script/assets in a normal bundled package folder. Both hosts load that folder directly from app files. Its default profile names the actual entry and uses the matching client/resource-preparation boundary. Discovery includes it without copying, installing or restoring it into managed user storage. Managed removal applies to imported user folders. Remove the earlier proposed Restore included engine action and its restore-only APIs. Settings reset keeps its existing settings-only behaviour.

## Mixed runtime and UI

Host selection happens once. Its binding table is keyed only by `EngineClientType`, pairing each client with its matching lifecycle backend:

```text
EngineRuntimeService -> binding for engine.clientType
  Uci       -> native process manager -> engine.entryPath
  UciWorker -> package/file loader    -> engine.entryPath
```

Desktop offers native and supported browser bindings together, including within one game. Browser offers its implemented browser bindings. Preserve `getEngineClient(clientType)` and obtain the matching lifecycle backend from the same table, avoiding independent switches. The assignment retains the returned IProcess reference and its copied clientType; validation, stop and restart pass that same reference to the selected pair. No process lookup or owner registry is needed.

Retain the shared base/subclass design completed by the [dependency correction and native follow-up](ArchivedPlans/BrowserEngineDependencyFixPlan.md#native-inheritance-follow-up). Both clients use the base's direct IProcess I/O and retain their existing _isProcessOpen/_getProcessExitDetail overrides. For this package rework, parameterise the base's hard-coded Uci assignment guard with the registered client enum value: the native subclass supplies Uci and the browser subclass supplies UciWorker. Other interfaces can implement `IEngineClient` directly. Preserve turns, pondering, analysis stop acknowledgement, supersession, pause/deferred-result and legality semantics. Each assignment owns its runtime; share package bytes, not sessions. Verify actual [NW.js worker configuration](https://docs.nwjs.io/References/Command%20Line%20Options/) and packaging.

Desktop Settings shows profiles and behaviour. Add/Edit/Copy navigates to EngineProfileView through a Settings child route. Package import and details have their own routed views. SettingsView keeps the shared shell and mounts them with RouterView; the URL and route lifecycle own navigation. Direct links/reload and browser Back/Forward must work without opening the overview first. Use modals only for simple confirmations or single-choice pickers. Browse opens the existing file dialog for an executable or script. Browser adds the discovered package-folder list and import/remove controls, then profile entry selection. Both retain name/options and Apply/Save/Discard. Existing foreign-host/native targets remain visible and repairable. Profile deletion changes configuration only. Game selectors use accepted profiles and copy exact launch data/options.

Follow the [UI specification](EngineManagementUiDesign.md), existing `.vue` ownership and shared global CSS. No new watchers, component style blocks or scope escapes.

## Detailed API

The signatures below describe the implemented application additions and architecture correction. Existing platform contracts are labelled separately for context. The additions implement the package-file and target-selection responsibilities above; the runtime API and shared IProcess contract remain unchanged. Signatures are grouped by their actual owner, rather than introducing another facade or profile-resolution service.

### Transient file inputs

```ts
export interface IEnginePackageFile {
  path: string;
  data: Uint8Array<ArrayBuffer>;
}
export interface IEngineArchive {
  files: readonly IEnginePackageFile[];
}
export interface IEnginePackageUsage extends IEngineLaunch {
  displayName: string;
}
```

For an archive input, path is the selected filename and data contains its original bytes. After decoding, each file path keeps its supplied relative layout inside the archive. These objects exist only for the current file action. They are not installation records, manifests or persisted editor state. DOM File/Blob objects stay in the view.

IEngineArchive contains the decoded files only, with no ZIP bytes, destination or package metadata. readArchive does not need an engine name. At Install, the view passes its current validated Engine name separately; the service derives the managed folder from that name. installPackage returns the resulting packagePath for Create profile. This keeps renaming the form independent of ZIP decoding and avoids a destination chosen from vendor metadata. IEnginePackageUsage contains a reference label and copied launch fields for removal checks.

### EnginesStore additions

```ts
canInstallPackages(): boolean;
refreshPackages(): Promise<void>;
listPackages(): readonly IEnginePackage[];
getPackage(packagePath: string): IEnginePackage | undefined;
browseEngineFile(startDirectory?: string): Promise<string>;
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>;
installPackage(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>;
removePackage(packagePath: string, readReferences: () => readonly IEnginePackageUsage[]): Promise<void>;
```

| Method | Caller and result | Effects and failure behaviour |
| --- | --- | --- |
| `canInstallPackages()` | Settings/import views ask whether managed package writes are available on this host | Synchronous capability only. Does not test storage health, permissions, file availability or engine compatibility. |
| `refreshPackages()` | Overview, details, profile and import views await discovery; Refresh and discovery Retry use the same action | Reads package folders and replaces the transient list only on success; preserves the last successful list on failure. Shares the actual pending discovery where no queued mutation intervenes. Does not skip a read because an earlier list exists or change a profile draft. |
| `listPackages()` | Overview and profile file selector read the loaded folders/files | Synchronous read of current memory; no I/O. An empty result before load is not proof that storage is empty. |
| `getPackage(packagePath)` | Details and Create profile look up one loaded folder | Synchronous exact-path lookup, returning undefined when absent. No discovery, registration or fallback selection. |
| `browseEngineFile(startDirectory?)` | Profile Browse awaits the chosen executable/script path | Opens the existing file dialog through the service. Returns a path only; cancellation leaves the local form intact. |
| `readArchive(file, signal?)` | Import view supplies the selected filename/original bytes and receives a decoded file review | Reads/validates without storage writes. Rejects invalid files or cancellation. Does not choose an entry/interface. |
| `installPackage(engineName, archive, signal?)` | Import confirmation supplies the frontend-validated Engine name and decoded files | Publishes to its unique folder, then refreshes. Returns packagePath for Create profile; creates no profile/installation record. |
| `removePackage(packagePath, readReferences)` | Confirmed removal supplies the folder and a current-reference reader | Checks references when its queued turn starts, deletes only stored package files and refreshes. Rejects blocked/failed deletion; it never removes profiles. |

Import, removal and discovery share the store's package-work queue, so a refresh cannot publish a list read before an issued mutation settled. Existing option discovery is not added to that queue. listPackages/getPackage read discovery results, not a persisted catalogue.

The removal caller supplies a function that reads current accepted/draft profiles and open-game assignments. Invoke it after queued work has settled, immediately before deletion, rather than keeping the list captured when Details opened. Presentation composes these inputs from SettingsStore and GamesStore; EnginesStore does not look up sibling stores. These references are the complete removal check. Temporary engine work adds no separate guard or tracking.

### EnginePackageService additions

EnginePackageService owns engine package operations and uses the private generic stored-file library for file persistence. There is no package adapter interface, platform getter or desktop package implementation.

```ts
canInstall(): boolean;
listPackages(): Promise<readonly IEnginePackage[]>;
browseEngineFile(startDirectory?: string): Promise<string>;
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>;
install(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>;
remove(packagePath: string, references: readonly IEnginePackageUsage[]): Promise<void>;
```

| Method | Caller, result and responsibility |
| --- | --- |
| canInstall | Returns the existing host capability without a storage probe. Browser permits import/removal; desktop uses direct targets. |
| listPackages | EnginesStore requests discovery. Use private generic file listings to construct engine folder names, sources, files and per-folder warnings, then add the ordinary bundled definition. Desktop returns only the bundled definition without a managed-storage scan. |
| browseEngineFile | Delegate through the existing platform/storage picker only when this user action runs. Return the actual executable/script path and preserve picker cancellation. |
| readArchive | Decode and validate the original ZIP into IEngineArchive. No storage, entry inference, client choice or engine launch. |
| install | Receive the frontend-validated name, validate archive contents, derive the folder root and await one atomic library write. Return the folder path; the store owns discovery refresh. Do not repeat engine-name format/uniqueness checks. |
| remove | Check the supplied accepted/draft profile and open-game references, then await one atomic library removal. Reject unsupported, referenced or failed removal. Never remove profiles, read sibling stores or delete desktop files. |

The private library owns generic IndexedDB operations using the existing database/store/compound-key format. EnginePackageService retains engine policy and the existing application operation/stage error contract. No lease or temporary-engine tracking is added.

The bundled definition comes from the same build asset definition supplying Stockfish's original scripts/WASM/licence. It is not copied into managed storage or discovered through an HTTP directory listing.

WorkerScriptLoader reads stored bytes directly, so there is no EnginePackageService.readFile API. Resolve the existing picker dependency only inside browseEngineFile. This adds no runtime/platform API or dependency from the generic library into an engine service.

### Existing platform interfaces

```ts
// IPlatformService: retain the existing client getter and change the
// manager getter to use the same binding. No package getter is added.
getEngineClient(clientType: EngineClientType): IEngineClient;
getProcessManager(clientType: EngineClientType): IProcessManager;

// IStorageAdapter: existing contract, unchanged.
showOpenDialog(startDirectory?: string): Promise<string>;

// IProcessManager: existing signatures; path wording changes and stop becomes idempotent.
spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>;
assertProcessOpen(process: IProcess): void;
stopProcess(process: IProcess): Promise<void>;
restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess>;
```

Both enum-keyed getters use one composition table pairing IEngineClient with IProcessManager. Desktop registers native and Worker pairs; browser registers its supported Worker pair. Unsupported types fail explicitly through existing error handling. The runtime stores the exact IProcess returned by spawnProcess and passes it to the pair selected by the assignment's copied clientType. The shared process contract, optional streams and exit-listener signatures are unchanged.

stopProcess resolves when its resource is already stopped instead of throwing InvalidProcessHandle. Its implementation uses a non-throwing closed-resource check before waiting; it does not call assertProcessOpen. The required IProcess parameter is unchanged. If no process reference exists, the runtime's existing cleanup already skips the manager call.

getEngineClient(clientType) returns the protocol/session owner; getProcessManager(clientType) returns the physical process/Worker lifecycle owner from that same pair. EngineRuntimeService calls both using the assignment's copied enum value. These getters return composed capabilities; none installs files, starts engines or resolves a profile.

### Platform composition only

Both clients already inherit the shared UCI base. This package rework adds only its registered client enum value; the existing protected hooks and direct process I/O remain:

```ts
// Implementation outline; existing operations/helpers are omitted.
abstract class UciEngineClientBase implements IEngineClient {
  protected constructor(private readonly _clientType: EngineClientType) {}
  protected abstract _isProcessOpen(process: IProcess): boolean;
  protected abstract _getProcessExitDetail(process: IProcess): string | undefined;
}
```

NwjsUciEngineClient calls super(EngineClientType.Uci); BrowserUciEngineClient calls super(EngineClientType.UciWorker). The base's private assignment guard and corresponding private assignment type follow that registered value. The subclasses retain their two existing hook implementations and receive no process manager, transport service or resolver callback. Each platform store continues to construct markRaw(new ClientClass()) and return that actual instance through getEngineClient; its binding table pairs the instance with the appropriate manager. No separate client store, factory or method-binding object is added. Enum configuration is the only new base change in this package rework.

Use NwjsProcessManager itself for both desktop client-type bindings. Move common Worker mechanics into private WorkerProcessManagerBase; BrowserProcessManager and NwjsProcessManager derive independently. Neither concrete manager imports or inherits the other.

This explicitly changes the current NW.js implementation: replace defineNwjsProcessManagerStore's Pinia setup function with a plain NwjsProcessManager class, constructed raw by NwjsPlatformService. Update journey construction directly. Remove the factory without a compatibility wrapper. Public platform/process/runtime APIs stay as specified.

NwjsPlatformService constructs two instances of this same class: NwjsProcessManager(EngineClientType.Uci) and NwjsProcessManager(EngineClientType.UciWorker). The existing enum selects native or inherited Worker behaviour. No filename inference, second selector, injected service/resolver or new spawn parameter is added.

~~~ts
declare abstract class WorkerProcessManagerBase implements IProcessManager {
  spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>;
  assertProcessOpen(process: IProcess): void;
  stopProcess(process: IProcess): Promise<void>;
  restartProcess(process: IProcess, entryPath: string, args?: string[]): Promise<IProcess>;
  dispose(): Promise<void>; // Concrete implementation lifecycle; not added to IProcessManager.
  protected _resolveWorkerUrl(entryPath: string): URL;
  private readonly _processes: Set<BrowserWorkerProcess>;
  private readonly _lifetime: AbortController;
  private readonly _scripts: WorkerScriptLoader;
}
declare class BrowserProcessManager extends WorkerProcessManagerBase {}
declare class NwjsProcessManager extends WorkerProcessManagerBase {
  constructor(clientType: EngineClientType);
  private readonly _clientType: EngineClientType;
  override spawnProcess(entryPath: string, args?: string[]): Promise<IProcess>;
  override assertProcessOpen(process: IProcess): void;
  override stopProcess(process: IProcess): Promise<void>;
  protected override _resolveWorkerUrl(entryPath: string): URL;
  // Inherited restart dispatches through this.stopProcess and this.spawnProcess.
}
~~~

This outline omits bodies and repeats no architecture-level API. Only NwjsProcessManager imports existing NodeUtility access for native spawn and file URLs. Its Worker URL hook receives the existing native-path implementation. Preserve ChildProcess identity, UTF-8 setup, liveness and once-exit/kill semantics; add no native registry or shutdown policy.

The base is private implementation support, not another composed platform interface or flow owner. It imports no concrete host manager/client/store. Keep its process set, lifetime signal and loader private. Only the existing URL hook is protected. BrowserProcessManager inherits the current same-origin default; NwjsProcessManager overrides native/app URL conversion.

Each platform store registers cleanup of its exact manager instances with onScopeDispose. Concrete dispose retains its existing promise contract for lifecycle cleanup; it is not added to IProcessManager. The callback starts that work and explicitly observes rejection; Vue/Pinia does not await scope callbacks. Tests await the returned promise. Native shutdown and unrelated close policy remain unchanged.

### Private call-depth correction

Public actions orchestrate their own work. spawnProcess directly resolves the host URL, awaits the self-contained loader, checks lifetime, wraps the returned Worker and registers the process for disposal. There is no preparation object, registration helper, readiness cache or cleanup relay in the manager.

WorkerScriptLoader.createWorker selects stored/app/file loading, reads stored files when needed, then calls its construction leaf. That leaf creates the asset URLs and bootstrap and returns the Worker; construction failure releases those same URLs. The returned Worker's terminate directly calls native termination and revokes its owned URLs. Storage operations retain direct database/transaction leaves. Do not introduce extra routing methods to shorten an already shallow operation.

Package list/install/remove, frontend validation, store queueing and reference-only removal remain as previously agreed. Removal protects accepted/draft profiles and open games only. No lease or temporary-operation registry is added.

| Owner | Direct responsibility |
| --- | --- |
| BrowserProcessManager.spawnProcess | Resolve URL, await loader, check lifetime, wrap/retain process; terminate on failure. |
| BrowserProcessManager._resolveWorkerUrl | Validate/encode the browser entry through the loader's generic URL operation. |
| NwjsProcessManager._resolveWorkerUrl | Existing Node path/URL conversion and host allow-list; no installation or file copy. |
| WorkerScriptLoader | Self-contained generic storage and Worker creation; no engine or platform owner references. |
| EnginePackageService | Engine package policy and direct generic storage operations. |
| EnginesStore | Existing package-work queue, rediscovery and transient list. |
| EnginePackageImportView | Name characters/uniqueness, discovery eligibility and import action lifecycle. |

### Reusable stored-file Worker library

The class is WorkerScriptLoader, not a static Utility object. Construct it with plain storage values; construction/import performs no IO and attaches no listeners.

~~~ts
interface IWorkerScriptLoaderConfig {
  databaseName: string;
  storeName: string;
  rootPath: string;
}
interface IWorkerScriptFile {
  path: string;
  data: Uint8Array<ArrayBuffer>;
}
class WorkerScriptLoader {
  constructor(config: IWorkerScriptLoaderConfig);
  listRoots(): Promise<string[]>;
  listFiles(root: string): Promise<string[]>;
  writeFiles(root: string, files: readonly IWorkerScriptFile[], signal?: AbortSignal): Promise<void>;
  removeFiles(root: string): Promise<void>;
  resolveUrl(entryPath: string, appBaseUrl: URL): URL;
  isStoredUrl(url: URL, appBaseUrl: URL): boolean;
  createWorker(entryUrl: URL, appBaseUrl: URL, signal?: AbortSignal, options?: WorkerOptions): Promise<Worker>;
}
~~~

| Library operation | Responsibility |
| --- | --- |
| listRoots/listFiles | Read original roots/relative file names from existing compound keys. No catalogue. |
| writeFiles/removeFiles | Validate generic file paths, await atomic completion/abort and close the database. Engine-name/reference rules stay outside. |
| resolveUrl/isStoredUrl | Encode stored path components and recognise the configured namespace with protocol/host/path checks, including nested app bases. |
| createWorker | Read one stored package in one transaction, preserving file-key/data pairing. Map JS/WASM/binary MIME types to Blob resources and construct the dedicated Worker. Ordinary app URLs use the native constructor directly; file URLs use the same bootstrap with original file paths. |
| Returned Worker.terminate | Terminate that Worker and revoke its own asset/bootstrap URLs. Repeated termination does not revoke them again. No loader-level registry or separate disposal API. |

The private bootstrap function is serialised into the Worker Blob. It uses only native APIs and its entry/asset arguments, with no outer-module references. Its replacements are local to that dedicated Worker's global object. It supplies an entry location, importScripts/fetch/XHR resolution, then imports the original entry. It installs no application-global fetch/activate/message listener. Nested Worker/module loading remains outside the selected implementation.

EnginePackageService uses a storage-only loader instance for discovery/import/removal. The manager owns its independent loader instance. No instance depends on another or shares a runtime registry. The existing database/store/compound-key schema and transaction completion/cancellation rules are unchanged.

### Corrective review before resuming

Review the full rework against its explicit scope and the user-owned decisions. No runtime/client APIs or unrelated function bodies change. Keep detailed flows for architectural callers and meaningful callbacks in the stacked single-column format below; library internals are terminal implementation support rather than extra architectural flow owners.

| Entry | Intended internal path |
| --- | --- |
| Worker spawn | spawnProcess -> host URL hook; spawnProcess -> createWorker; then process construction and tracking. |
| Stored Worker loading | createWorker -> readonly file transaction; createWorker -> construction leaf. No registration/control branch. |
| Package storage/discovery | Public package action -> generic file operation; no domain-specific storage relay chain. |
| Package refresh | refreshPackages passes _readPackages directly to _queuePackageWork, which calls the existing public service boundary. |
| Resource release | Process closure -> Worker.terminate -> native terminate and local URL revocation. |

### Existing runtime boundary

EngineRuntimeService has no API changes in this plan. Its unchanged signatures and lifecycle are not reproduced in this API design. Existing [runtime ownership](LowLevel/ProcessFlows/EngineRuntimeOwnership.md) and [engine-client contracts](LowLevel/Architecture/PlatformAbstraction/EngineClient.md) remain authoritative. Only the internal substitutions explicitly listed under [Implementation boundary](#implementation-boundary) are in scope.

Existing EnginesStore profile-selection and option-discovery APIs also retain their signatures and behaviour. Their launch-field/cache comparisons use entryPath and clientType and drop protocol as already specified. Package operations do not wrap or replace getOptions. No new cancellation parameter is added to spawnProcess or option discovery.

### Open API decisions

The first-use, naming, uniqueness, metadata and Blob-loading decisions are recorded in [Questions to answer before implementation](#questions-to-answer-before-implementation). The listed choices are settled. The removal decision is also settled: accepted/draft profiles and open games are the only removal checks. Package installation creates a unique named folder; there is no implicit replacement or separate version policy. The selected loading mechanism and ownership correction are implemented. The tested engine/build limitations remain recorded below.

File-action failures also need to retain their failing operation/stage through the existing error contract. A read/validation/transaction failure leaves no new files; a discovery failure after commit leaves the files installed and offers Refresh/Retry. The same distinction applies after a successful removal. Do not report every rejected store promise as a rolled-back file operation or add another persistence/error subsystem to hide that distinction.

## Function flows

Use the [stacked-table convention](LowLevel/ProcessFlows/index.md#conventions): each header is one caller, each row is a direct call in execution order, and follow-on tables expand delegated calls. Branches have separate tables. State writes, ownership and error behaviour sit outside the tables. Framework primitives, private imported-library work and unchanged runtime APIs are terminal implementation boundaries here. The library API is specified above for review and is not a flow owner. Explain its work beneath the owning action instead of introducing forwarding helpers to create table rows. Expand only the new or changed rework paths; retain the existing runtime lifecycle in its linked documentation. A contextual call is not an API change.

An Owner._helper label identifies an internal call within that owner's class, module or composable; it does not imply that the helper is returned/exported as an object member. Public cross-owner calls use the declared store/service/adapter contracts. Underscore-prefixed local action/callback labels are expanded in their enclosing owner's scope, rather than being additional APIs. Component loading and route guards are private callbacks registered with Vue/Router hooks.

### Routed profile editing and file browsing

Route definitions and the complete view navigation remain in the [UI function flows](EngineManagementUiDesign.md#presentation-function-flows). SettingsView stays mounted, and RouterView mounts separate profile/import/details views. The route and Settings draft provide all editor inputs; no modal handle or hidden opener state is required.

New profile branch:

| `SettingsView._openEngineEditor()` |
| --- |
| `Router.push({ name: 'engine-profile-new', params: { category: 'engines' } })` |

Edit branch:

| `SettingsView._openEngineEditor(profile)` |
| --- |
| `Router.push({ name: 'engine-profile-edit', params: { category: 'engines', profileId: profile.id } })` |

| `EngineProfileView._load()` |
| --- |
| `SettingsStore.loadSettings()` |
| `EnginesStore.refreshPackages()` |

Vue invokes the private _load callback through onMounted; it is not a component API. New/edit/copy mode comes from the route. After settings load, copy the selected draft record and options into the local form, or show the missing-profile state. Then await package discovery separately; its failure offers Retry for file choices without hiding the editable form/current path. Read listPackages for the file selector, and getPackage only when resolving a packagePath hint. This also works for a direct profile URL without first visiting the overview. Stored package targets are chosen from the discovered files; selecting one changes the local entryPath only.

| `EngineProfileView._browseEngineFile()` |
| --- |
| `EnginesStore.browseEngineFile(startDirectory)` |

| `EnginesStore.browseEngineFile(startDirectory)` |
| --- |
| `EnginePackageService.browseEngineFile(startDirectory)` |

| `EnginePackageService.browseEngineFile(startDirectory)` |
| --- |
| `IPlatformService.getStorageAdapter()` |
| `IStorageAdapter.showOpenDialog(startDirectory)` |

Copy the returned executable/script path to the local form. Existing picker cancellation leaves it intact. Do not use the browser document-import adapter's transient UTF-8 token as an engine path or ZIP input.

| `EngineProfileView._saveEngine()` |
| --- |
| `Router.replace({ name: 'settings', params: { category: 'engines' } })` |

Validate the existing required/unique name rules, copy launch fields/options to the Settings draft, then navigate. This action does not apply settings, import files or start a runtime. Back/Cancel/history navigation discards only the local form.

| `SettingsStore.applySettings()` |
| --- |
| `SettingsStore._saveDraftSettings()` |

| `SettingsStore.saveSettings()` |
| --- |
| `SettingsStore._saveDraftSettings()` |

| `SettingsStore._saveDraftSettings()` |
| --- |
| `SettingsStore.loadSettings()` |
| `SettingsStore._requireDraftSettings()` |
| `toRaw(draft)` |
| `UserSettingService.saveSettings(draft)` |
| `SettingsStore._acceptSettings(acceptedSettings)` |

These are the existing settings calls. Their [persistence flow](LowLevel/ProcessFlows/PersistenceAndAdministration.md) remains unchanged apart from the current profile fields/schema. No package discovery, file-availability check or engine handshake is added to Apply/Save.

### Retrieving package folders

| `EnginePackageDetailsView._load()` |
| --- |
| `EnginesStore.refreshPackages()` |
| `EnginesStore.getPackage(packagePath)` |

The details view registers its private _load callback with onMounted. For the overview, SettingsView's mount/category route-update handler explicitly invokes its private _loadEnginePackages callback for the engines category. Refresh explicitly calls refreshPackages. No watcher or polling is involved.

Import owns its own initial discovery, including direct import URLs:

| `EnginePackageImportView setup` |
| --- |
| `onMounted(_refreshPackages)` |

| `EnginePackageImportView._refreshPackages()` |
| --- |
| `EnginesStore.refreshPackages()` |
| `EnginesStore.listPackages()` |

The private action closes the view's discovery-ready gate before starting and opens it only after a successful fresh read. It keeps one actual pending read action; Retry awaits a new attempt after failure. Initial loading, a failed refresh or an outstanding package mutation disables Install, even when a previous list remains visible. The import view does not depend on SettingsView having loaded first. After discovery succeeds, name validation uses that already loaded list without another store/service name check.

Initial discovery and later refreshes use the same action. Concurrent callers share the actual queued/running discovery promise when no mutation has been queued between them; a refresh requested after a mutation awaits a read after that mutation. An earlier successful list does not skip discovery.

| `EnginesStore.refreshPackages()` |
| --- |
| `EnginesStore._queuePackageWork(_readPackages)` |

| `EnginesStore._readPackages()` |
| --- |
| `EnginePackageService.listPackages()` |

Replace the transient list only after successful discovery. Clear the actual in-flight read owner when it settles, permitting Retry after failure. getPackage finds a folder by packagePath; listPackages returns the current list.

Browser discovery branch:

| `EnginePackageService.listPackages()` |
| --- |
| `EnginePackageService.canInstall()` |

The public action calls its private stored-file library's listRoots/listFiles operations, derives each folder name/source and constructs IEnginePackage results. Add the ordinary bundled definition. A root-list failure rejects discovery; each individual folder read failure retains its warning. Reads enumerate keys only, without loading engine bytes or interpreting vendor metadata.

Desktop branch:

| `EnginePackageService.listPackages()` |
| --- |
| `EnginePackageService.canInstall()` |

Return the bundled build-declared definition without reading managed storage; external desktop targets stay in profiles.

Generic database opening/transactions are private library implementation, documented under Reusable stored-file Worker library rather than modelled as EnginePackageService helper chains. Public package actions still own their app decisions and sequencing. No _withFiles, _listStoredPackagePaths, _readPackage or _listStoredFiles relay is added.

| `EnginesStore.canInstallPackages()` |
| --- |
| `EnginePackageService.canInstall()` |

| `EnginePackageService.canInstall()` |
| --- |
| `getPlatformTarget()` |

Use the existing resolved PlatformTarget value. This is a capability result, not a new platform contract or a storage probe.

### Reading and importing an archive

| `EnginePackageImportView._chooseArchive(file)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |
| `file.arrayBuffer()` |
| `new Uint8Array(buffer)` |
| `EnginesStore.readArchive({ path: file.name, data }, signal)` |

The view owns one file action and its AbortController. It records the operation before starting asynchronous work, prevents duplicate starts, and checks cancellation after an uninterruptible File read. Replacing the input first aborts/settles the old read. Only original bytes cross into the store. The result becomes the local file review, with no selected entry/interface and no writes.

| `EnginesStore.readArchive(file, signal)` |
| --- |
| `EnginePackageService.readArchive(file, signal)` |

| `EnginePackageService.readArchive(file, signal)` |
| --- |
| `EnginePackageService._decodeArchive(file, signal)` |
| `EnginePackageService._validatePackageFiles(archive)` |

_decodeArchive uses the ZIP reader to return the supplied relative paths and bytes. _validatePackageFiles rejects empty/invalid archives, absolute or escaping paths and conflicting file paths; it does not require a particular script filename or manifest. Cancellation stops further decoding and publishes no review/write. These are file helpers, not an engine-inspection stage.

| `EnginePackageImportView._install()` |
| --- |
| `EnginePackageImportView._validateEngineName(engineName)` |
| `EnginesStore.installPackage(engineName, archive, signal)` |

| `EnginesStore.installPackage(engineName, archive, signal)` |
| --- |
| `EnginesStore._queuePackageWork(_installAction)` |

| `_installAction()` |
| --- |
| `EnginePackageService.install(engineName, archive, signal)` |
| `EnginePackageService.listPackages()` |

| `EnginePackageService.install(engineName, archive, signal)` |
| --- |
| `EnginePackageService.canInstall()` |
| `EnginePackageService._validatePackageFiles(archive)` |
| `signal.throwIfAborted()` when supplied |

The public install action directly awaits its private library's atomic writeFiles operation for the derived root and original archive bytes. Generic path validation and transaction settlement remain library implementation; no engine-specific write wrapper is introduced. Translate actual failures using the existing install operation/stage contract.

The view stops submission unless discovery succeeded, a decoded archive is ready and no file/discovery action is outstanding, then validates name format and uniqueness against its already loaded list. Starting installation closes its local discovery-ready gate until the store's post-write discovery succeeds. The service derives the managed root from the frontend-validated engineName and writes the files directly; it repeats neither name check. The store retains the returned packagePath, refreshes discovery, then returns that same path to the view for Create profile. No vendor name/version or ZIP filename determines the destination.

Reject an unsupported host and check cancellation before issuing the transaction. Once issued, the service's returned promise stays owned until the actual transaction commits or aborts. A cancellable transaction may abort, but rejecting a UI promise alone does not settle publication. Atomic commit publishes all original files; failure/abort publishes none. Discovery runs afterwards, with no catalogue or manifest publication. A discovery failure after commit reports that the files were saved and the list needs Retry; it does not claim installation rolled back.

On discovery failure, the import view keeps Install disabled and offers _refreshPackages as Refresh/Retry. For a committed install, retry only discovery; do not reissue publication. After a failed write, require successful discovery and repeat frontend validation before another Install. This avoids treating the retained pre-commit list as authoritative without adding backend name validation or replacement semantics.

Shared sequencing helper:

| `EnginesStore._queuePackageWork(action)` |
| --- |
| `await previous package work settlement` |
| `action()` |

Keep the actual action promise for its caller, with a settled queue tail for the next action. Each owner observes its own failure. Reads and mutations use this same queue; mutation callbacks already executing inside it call EnginePackageService.listPackages directly rather than recursively queueing and deadlocking. This is in-memory operation ownership, not a new persisted queue.

### Leaving import and using included app files

The import view registers these private callbacks with onBeforeRouteLeave(_beforeRouteLeave) and onBeforeRouteUpdate(_beforeRouteUpdate). They are Router callbacks, not methods exposed by the component.

| `EnginePackageImportView._beforeRouteLeave(to, from)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |

| `EnginePackageImportView._beforeRouteUpdate(to, from)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |

Read branch:

| `EnginePackageImportView._settleFileAction()` |
| --- |
| `owned AbortController.abort()` |
| `await actual file-action settlement` |

Issued publication branch:

| `EnginePackageImportView._settleFileAction()` |
| --- |
| `await actual publication and follow-up settlement` |

Expected cancellation is consumed by the read owner. Allow navigation only after settlement, including browser Back. Success leaves files only; Create profile routes to a new editor with packagePath as a hint, without auto-selecting an entry or applying settings.

The included engine has no import/restore action: its ordinary package is already available from app files. Desktop Use included Stockfish fills its supplied script path; browser profile selection offers the same included folder directly. Managed removal applies to user-imported folders.

| `SettingsStore.resetSettings()` |
| --- |
| `SettingsStore.loadSettings()` |
| `UserSettingService.resetSettings()` |
| `SettingsStore._acceptSettings(acceptedSettings)` |

Reset remains settings-only. It does not import/copy engine files or introduce first-run state.

### Removing stored package files

| `EnginePackageDetailsView._removePackage()` |
| --- |
| `IModalController.open(ConfirmationModal, confirmationProps)` |

confirmationProps supplies the view's private _confirmRemovePackage as the existing confirm callback, with dismissibleWhileWorking false. Opening or cancelling the modal does not delete files. ConfirmationModal owns awaiting that callback and displaying its error through its existing action handling.

| `EnginePackageDetailsView._confirmRemovePackage(signal)` |
| --- |
| `signal.throwIfAborted()` |
| `EnginesStore.removePackage(packagePath, _readReferences)` |

The view's private _readReferences callback reads SettingsStore.settings, SettingsStore.draftSettings and GamesStore.listGames(), projecting profiles and player/analysis assignments to IEnginePackageUsage. It is passed as the store's readReferences parameter, not exposed as another API. Include accepted profiles even when deleted only in the draft. The source data is read again when deletion reaches the queue, rather than using Details' displayed snapshot. Once issued, removal remains owned until deletion and refresh settle; the modal's signal adds no cancellation parameter to the store/service.

| `EnginesStore.removePackage(packagePath, readReferences)` |
| --- |
| `EnginesStore._queuePackageWork(_removeAction)` |

| `_removeAction()` |
| --- |
| `readReferences()` |
| `EnginePackageService.remove(packagePath, references)` |
| `EnginePackageService.listPackages()` |

| `EnginePackageService.remove(packagePath, references)` |
| --- |
| `EnginePackageService.canInstall()` |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` |

After checking references, the public action directly awaits its private library's atomic removeFiles operation. The library knows no profile/game rules, and the service retains the existing application error contract.

Reject an unsupported host before file work. _assertPackageUnreferenced checks compatible virtual entry paths by exact package boundary, not string-prefix coincidence; native executable targets are not managed package references. Pass named references back to the view when blocked. Do not delete/retarget profiles or assignments.

After the queued action reads current profile/game references, removal checks them and issues the atomic file transaction. Keep ownership until transaction completion/abort and discovery refresh settle. Temporary engine operations add no removal check. Only managed browser files are removable; desktop executables and folders remain outside removal scope.

### Launch-data integration and platform binding

The existing option cache compares clientType/entryPath instead of clientType/executablePath/protocol. Retain its profile-id keys, successful-result check and existing getOptions call. Option discovery gains no package lookup, installation state, file fingerprint or cancellation API. Its temporary assignment copies the revised launch fields; the existing runtime still owns its initialisation and cleanup.

Player and analysis selectors copy the revised launch fields/options through their existing handlers. Keep game-creation preflight, subscriptions, player-turn handling and runtime lifecycle unchanged; their full flows remain in the [runtime ownership document](LowLevel/ProcessFlows/EngineRuntimeOwnership.md). No install/resolve/check step is inserted into assignment.

The runtime call-site edits are limited to those named under [Implementation boundary](#implementation-boundary). They use the following platform lookups; this changes internal binding selection without changing any EngineRuntimeService API:

| `IPlatformService.getEngineClient(clientType)` |
| --- |
| `shared binding table lookup by clientType` |

| `IPlatformService.getProcessManager(clientType)` |
| --- |
| `same binding table lookup by clientType` |

The client lookup already takes clientType. Add that argument to the manager lookup at the listed call sites so startup, process validation and release use the same registered pair. Keep the returned IProcess in runtime.process. Never infer the pair from a process reference or package source.

Desktop construction uses NwjsProcessManager for both bindings:

| `NwjsPlatformService setup: Uci binding` |
| --- |
| `markRaw(new NwjsProcessManager(EngineClientType.Uci))` |
| `markRaw(new NwjsUciEngineClient())` |
| `onScopeDispose(nativeManagerDisposalCallback)` |

| `NwjsPlatformService setup: UciWorker binding` |
| --- |
| `markRaw(new NwjsProcessManager(EngineClientType.UciWorker))` |
| `markRaw(new BrowserUciEngineClient())` |
| `onScopeDispose(workerManagerDisposalCallback)` |

Browser construction:

| `BrowserPlatformService setup: UciWorker binding` |
| --- |
| `markRaw(new BrowserProcessManager())` |
| `markRaw(new BrowserUciEngineClient())` |
| `onScopeDispose(workerManagerDisposalCallback)` |

Each manager privately constructs its own loader from configuration, without starting it. The native-configured instance retains native process behaviour. Journey injection constructs that configured class directly after installing its existing Node overrides. Remove the old Pinia manager factory outright.

| `NwjsPlatformService: nativeManagerDisposalCallback` |
| --- |
| `nativeManager.dispose()` |

| `NwjsPlatformService: workerManagerDisposalCallback` |
| --- |
| `workerManager.dispose()` |

| `BrowserPlatformService: workerManagerDisposalCallback` |
| --- |
| `workerManager.dispose()` |

Each callback immediately observes the returned promise's rejection through the existing error/logging boundary. The framework does not await scope callbacks; the manager's promise retains actual cleanup until settlement. No store/controller registry or new application-close protocol is added.

Concrete manager headers below include inherited methods. WorkerProcessManagerBase is private implementation support and gets no separate architectural flow tables.

### Worker creation and local script loading

The native-configured NwjsProcessManager retains its exact spawn/UTF-8/liveness/exit-wait operations. The Worker-configured instance delegates to the shared base on this same object. No concrete browser manager is constructed or called by NwjsProcessManager.

| `NwjsProcessManager.spawnProcess(entryPath, args): Uci branch` |
| --- |
| childProcess.spawn(entryPath, args, { stdio: 'pipe' }) |
| process.once('spawn', _handleSpawn) |
| process.once('error', _handleError) |

| `NwjsProcessManager.spawnProcess: _handleSpawn callback` |
| --- |
| process.stdout.setEncoding('utf8') |
| process.stderr.setEncoding('utf8') |
| _cleanup() |
| markRaw(process) |

The callback resolves with the exact ChildProcess. Its existing _handleError/_cleanup callbacks remove temporary startup listeners and preserve the current error contract.

| `NwjsProcessManager.spawnProcess(entryPath, args): UciWorker branch` |
| --- |
| super.spawnProcess(entryPath, args) |

| Resource | Owner |
| --- | --- |
| Loader | Private field on this manager; configuration and generic operations only. No shared registration or Worker registry. |
| Pending read | This launch's IndexedDB transaction, cancelled by manager-lifetime abort. Independent launches do not wait for another launch. |
| Worker and Blob URLs | One returned Worker owns its own assets/bootstrap. Its normal terminate releases them. |
| Process | One BrowserWorkerProcess per spawn; its managed exit removes it from this manager's disposal set. |
| UCI startup | Existing client/runtime. No new process-ready wait, timeout or message queue. |

| `BrowserProcessManager.spawnProcess(entryPath, args)` |
| --- |
| _lifetime.signal.throwIfAborted() |
| this._resolveWorkerUrl(entryPath) |
| await _scripts.createWorker(url, appBaseUrl, _lifetime.signal, { name: 'ChessVue UCI' }) |
| _lifetime.signal.throwIfAborted() |
| new BrowserWorkerProcess(worker) |
| markRaw(process) |
| _processes.add(process) |
| process.once('exit', _onProcessExit) |

Reject unsupported arguments first. The loader completely owns file reading, bootstrap and native Worker construction. After awaiting it, check manager disposal before wrapping/retaining the result. The action's catch terminates any returned Worker and translates the failure into the existing ProcessStartFailed contract. No extra creation/preparation API is added to the platform or runtime.

A stored launch reads all files for that package in a single transaction, derives virtual paths under the app base, then creates its own Blob resources and Worker. Concurrent/later launches repeat that process independently. An ordinary app launch performs no stored-file read or Blob allocation. A desktop file launch uses the generic Blob bootstrap with direct file import/fetch/XHR resolution. All three return the same process contract.

| `BrowserProcessManager._resolveWorkerUrl(entryPath)` |
| --- |
| _scripts.resolveUrl(entryPath, appBaseUrl) |

Validate same-origin HTTP(S) and reject native executable/filesystem targets in the browser. Stored paths encode each component, preserving spaces, percent/hash characters and nested filenames. Profiles retain their actual entry paths.

| `NwjsProcessManager._resolveWorkerUrl(entryPath): absolute filesystem branch` |
| --- |
| NodeUtility.getNodePath() |
| path.isAbsolute(entryPath) |
| NodeUtility.getNodeUrl() |
| nodeUrl.pathToFileURL(entryPath) |

Use existing host path rules and Node URL escaping for drive-letter, UNC and POSIX paths. The loader receives the resulting file URL; it never constructs a dedicated Worker directly from that external URL.

| `NwjsProcessManager._resolveWorkerUrl(entryPath): app-relative/explicit URL branch` |
| --- |
| NodeUtility.getNodePath() |
| path.isAbsolute(entryPath) |
| new URL(entryPath, appBaseUrl) |

Retain current file/current-extension/same-origin HTTP(S) validation. Bundled entries use their actual app URLs. No copied files, changed flags, injected resolver or localhost server is introduced.

Worker creation returns before script/WASM/UCI readiness. The native Worker message queue accepts commands while its scripts start. Existing client initialisation sequencing stays unchanged. Observed errors close the wrapper and reach Worker.terminate, which releases this Worker's Blob URLs.

| `BrowserUciEngineClient constructor()` |
| --- |
| `super(EngineClientType.UciWorker)` |

| `NwjsUciEngineClient constructor()` |
| --- |
| `super(EngineClientType.Uci)` |

Both subclasses already exist and inherit UciEngineClientBase. Their constructors supply the new registered enum parameter; the existing _isProcessOpen and _getProcessExitDetail overrides are unchanged. Both retain inherited initialisation. The platform store constructs each client with markRaw and retains it in the corresponding enum-keyed binding. getEngineClient returns that same plain instance. No process registry, client Pinia facade, resolver injection or separate protocol discriminator is added.

The base's only package-rework change is that enum parameter and its private assignment guard/type. Existing handshake, option application, analysis/player operations, parsing, stop acknowledgement and session cleanup remain unchanged; they are not expanded here. BrowserWorkerProcess still turns stdin lines into Worker.postMessage(command), and string message events into stdout chunks for the base's existing line parser. Native streams continue through that same base I/O.

### Worker resource release

Existing runtime stop/restart/disposal reaches the process manager through its unchanged public signatures. Only its enum-keyed lookup changes in EngineRuntimeService. The manager lifetime cancels pending local file reads. The existing process exit listener removes the closed process from the disposal set. stopProcess returns successfully for an already-stopped resource; its live-process shutdown sequence, restart sequencing and the wrapper's managed closure are retained.

Live browser process branch:

| `BrowserProcessManager.stopProcess(process)` |
| --- |
| `new Promise<void>(...)` |

| `BrowserProcessManager.stopProcess: Promise executor` |
| --- |
| `process.once('exit', () => resolve())` |
| `process.kill()` |

Already-stopped browser branch: if the reference is not a BrowserWorkerProcess or its closed flag is set, return successfully without installing an exit listener or calling kill. No further calls are made. The existing exit listener has already removed a closed wrapper from the disposal set.

NW.js Worker-configured branch:

| `NwjsProcessManager.stopProcess(process): UciWorker branch` |
| --- |
| `super.stopProcess(process)` |

This executes the same inherited Worker stop body on the NW.js instance. It neither resolves a peer manager nor changes per-process cleanup.

Native-configured branch:

| `NwjsProcessManager.stopProcess(process): Uci branch` |
| --- |
| `NwjsUtility.isProcessOpen(process)` |
| `new Promise<void>(...)` when still open |

| `NwjsProcessManager.stopProcess: native Promise executor` |
| --- |
| `process.once('exit', () => resolve())` |
| `process.kill()` |

If the existing native liveness utility returns false, return successfully before constructing the promise. Neither stop implementation calls assertProcessOpen or rejects solely because its resource has already stopped. Exit events are not replayed, so the closed branch must return instead of waiting for another event. Existing runtime session cleanup continues normally, and its handling of InvalidProcessHandle elsewhere is retained.

The terminal process.kill call uses the existing [BrowserWorkerProcess implementation support](LowLevel/Architecture/UtilityIndex.md#browserworkerprocess). Its private _close marks it closed, retains exit detail, detaches Worker handlers, terminates the Worker and notifies exit listeners with (null, null), then clears listeners/input. Repeated kill returns false without another notification. Observed error/messageerror and postMessage failures use that same closure. This support object is not an architecture-flow owner, so it has no separate caller tables here. Managed closure is not a physical Worker-exit acknowledgement.

Manager-owned exit listener, registered during spawn:

| `BrowserProcessManager.spawnProcess: local _onProcessExit()` |
| --- |
| `_processes.delete(process)` |

The listener removes the exact process from _processes. BrowserWorkerProcess takes only the Worker and has no package dependency. The set is used only to dispose live wrappers, never to resolve a process reference.

Existing restart:

| `BrowserProcessManager.restartProcess(process, entryPath, args)` |
| --- |
| `BrowserProcessManager.stopProcess(process)` |
| `BrowserProcessManager.spawnProcess(entryPath, args)` |

Await stop before spawning the replacement. If the old process already stopped, stop resolves and restart still spawns the replacement. A live old process is removed from the disposal set through its exit listener; a closed one has already been removed. The replacement is a separate Worker/process. NwjsProcessManager inherits this restart sequence; its configured native/Worker spawn and stop overrides are selected through the same existing methods.

Platform disposal releases the manager-owned loader as well as its Workers:

| `BrowserProcessManager.dispose() inherited implementation` |
| --- |
| `_lifetime.abort(processStartFailure)` |
| `process.kill() for each process in a snapshot of this._processes` |

| `NwjsProcessManager.dispose() inherited implementation` |
| --- |
| `_lifetime.abort(processStartFailure)` |
| `process.kill() for each process in a snapshot of this._processes` |

Those synchronous steps cancel pending stored reads and close this manager's live Workers. Worker termination immediately revokes the URLs owned by that Worker. A loader result delivered after disposal is terminated by spawnProcess's catch before a process is returned. There is no shared registration or remote-context disposal to await. Concrete dispose retains its promise signature; platform scope callbacks keep observing its rejection.

Stopping one process leaves the other Workers and their assets intact. Constructor failure releases any URLs allocated before the native constructor threw. Missing files and storage failures reject the current launch through the existing error boundary. Repeated stop/disposal remains harmless. No timeout, generation guard, global registry, migration or retry UI is introduced.

The native-configured instance gains no child-process registry or shutdown policy. Existing runtime owners still release native children. Its inherited disposal set contains only Worker wrappers created by that instance.

## Current verification limits

The Blob-loader correction passes 919 unit/application tests across 105 files, all 28 normal-browser tests and npm run build, including the code audit and TypeScript projects. Removal of the server/registration tests and their replacement with loader/resource tests accounts for the changed unit count.

Generic browser checks use an independent database/store/root and make service-worker access throw. They verify original sibling scripts, binary assets, fetch URL/Request handling, XHR, special-character names, independent Workers, exact script bytes, transaction rollback/cancellation, missing entries and constructor-failure cleanup. Repeated normal termination revokes each Worker's URLs once and leaves another Worker running. The browser package UI also imports original Stockfish/WASM and resumes analysis across reload with no registration.

The minified production app was built with base /chess-vue/ and served through a simulated static HTTPS origin, https://owner.github.io/chess-vue/. Original Lozza and Stockfish/WASM each produced three analysis lines concurrently. SHA-256 comparisons confirm original JS/WASM bytes were present unchanged in the created Blobs. No imported-engine request reached the host, no file bytes were uploaded and service-worker access was prohibited. This is a normal Chromium static-host simulation, not a deployed GitHub Pages site.

Real NW.js SDK 0.119.2 passes native, bundled and original external Lozza/Stockfish handshakes and simultaneous four-engine analysis. Native ChildProcess identity and UTF-8 streams remain unchanged. External Lozza stops/recreates and resumes analysis while the other engines remain alive. Raw Workers created only through WorkerScriptLoader also load external sibling importScripts, binary fetch and XHR assets. Final runtime stop/manager disposal completes; a process check finds no test NW.js or native Stockfish process left running.

Reports: ignored node_modules/.cache/codex/WorkerScriptLoaderUnit.json, WorkerScriptLoaderHosted.json and WorkerScriptLoaderNwjs.json; the browser run is recorded in test-results/JourneyResults.json. The build emits no stored-file service-worker entry. Detailed API and stacked function flows above retain the agreed presentation and existing runtime/client boundaries.

The selected bootstrap does not support nested Workers or module-worker imports. Earlier experiments and the direct external-file Chromium origin failure are documented in [External Worker loading experiments](ExternalWorkerLoadingExperiments.md). The loader uses a Blob bootstrap for file entries to avoid direct external-file Worker construction; it does not change the host's flags or start a server.

### Earlier verification

Before this Blob replacement, the service-worker correction passed 925 unit/application tests across 106 files, 27 browser tests, five affected scripted journeys, production Lozza and real NW.js native/bundled Worker checks. Those results describe the preceding mechanism; they do not verify the new loader. Existing package/profile/runtime contracts and routed UI remain unchanged. Reports from that implementation remain under ignored node_modules/.cache/codex and test-results.

## Current contract changes and delivery

Remove engine `protocol`, `EngineProtocol`, `engineProtocols` and `engineProtocolSchema` from contracts/schemas, copies/defaults, option-cache keys, imports/fixtures and the read-only Protocol row as the current EngineProfileModal form moves into the page editor. Retain unrelated `URL.protocol` checks. Update only references required by the specified launch-field, enum, default and protocol-removal changes in callers, fixtures and architecture examples. Preserve the [implementation boundary](#implementation-boundary); this does not authorise runtime API changes or surrounding refactors.

Keep settings, saved-game and unrelated session/layout documents at their initial schema version. The app is unreleased; change the current readers, writers, defaults and fixtures together. There are no migration helpers, version branches, alias mappings or compatibility representations. No package-manifest schema exists.

Profiles and assignments store the exact entry path, client type, label and options. Exports omit engine binaries and runtime state. Parsing a saved game does not start an engine or import package files. Missing files or a foreign-host path remain current-format availability errors with explicit relink.

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 0. UI review | Actual entry-file selection, desktop direct paths, browser-only import | Validated unique engine name/folder, no version field, no assumed entry filenames/manifests or desktop installation. |
| 1. Runtime proof | Real Stockfish plus an independent worker using upstream layouts | Bundled files and Blob-loaded imports execute original entries/assets; reload, normal runtime operations and per-Worker cleanup pass. |
| 2. Current contracts | Entry path, single client enum, source enum, protocol removal | Exact paths/options round-trip without installation ids or new package metadata. |
| 3. Package files | Generic stored-file library plus engine folder discovery/import/removal | No package writes on desktop, browser list reconstructs from files, the frontend blocks duplicate names using that list and cancelled/failed import publishes nothing. |
| 4. Composition/defaults | Matching client/resource owners, ordinary bundled files/profile | Native/browser runtimes coexist with isolated stop/crash/restart; default uses same loader. |
| 5. Acceptance | Forms, focused tests, browser/NW.js journeys and architecture docs | Exact entry selection, Apply/Cancel, recovery and reference checks; separate simulation from real runtime results. |

Acceptance criteria remain below. Current correction evidence, historical results and the nested/module Worker limitations are recorded above:

| Area | Required evidence |
| --- | --- |
| Reusable library and object ownership | Run a non-UCI Worker with stored sibling scripts/binaries using only WorkerScriptLoader. No engine/platform imports or separate serving entry. Preserve original bytes; Worker.terminate releases its own Blob URLs. |
| Independent loading | Concurrent stored launches create independent reads/Workers/assets. One failure or stop does not affect another. Ordinary app entries skip storage and Blob allocation. No service-worker access or host engine request. |
| Manager-owned disposal | Cancel pending reads and stop only owned Workers. A result delivered after disposal is terminated. Verify asset release on constructor failure, normal stop, observed errors and repeated cleanup; no timeout or global registry. |
| Platform composition and native parity | No extra desktop Worker manager or concrete peer dependency. Existing enum selects native/Worker instances of NwjsProcessManager. Preserve native bodies, exact process/UTF-8 guarantees and UCI hooks. |
| Idempotent stop | Both managers return successfully for an already-stopped resource without waiting for another exit or killing it again. A live stop still subscribes before kill and awaits exit. Repeated stop after closure succeeds, and restart from a closed process still spawns the replacement. |
| Desktop entry URLs | Verify drive-letter/UNC/POSIX paths, spaces, Unicode, percent/hash characters, bundled app-relative entries and rejection of unsupported URLs. Real packaged NW.js loads a supplied entry outside the app directory with sibling scripts/WASM and ordinary analysis/play; URL-unit checks alone are insufficient. |
| Frontend discovery eligibility | A direct import URL with delayed/failed discovery cannot install. An empty successful read can enable a valid new name. A committed write followed by failed refresh keeps Install disabled; Retry only discovers files. A failed write requires discovery/name revalidation before another attempt. All name checks remain in the view. |
| Flow ownership, utilities and depth | Stacked tables retain architectural callers and meaningful callbacks; utilities are not flow owners or hidden coordination boundaries. Verify that removal uses only current accepted/draft profiles and open-game references; temporary work adds no tracking. Check the shallow call paths without forwarding/error/cleanup relays; runtime APIs remain unchanged. |

Cover unique/invalid engine names, folder-name display, ambiguous multi-build archives, Node-only metadata entries, helper-worker confusion, different layouts/names, absent scripts/assets, path traversal, external changes, missing/foreign-host paths, cancellation/disposal and ignored protocol removal. Run `npm run check:code`, focused Vitest suites, affected Playwright journeys and `npm run build` after implementation. Record actual Blob-loader results separately from the earlier service-worker results; do not treat the historical runs as verification of this implementation.
