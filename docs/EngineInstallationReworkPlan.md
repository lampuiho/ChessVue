# Engine targets, browser packages and profiles

Prepared on 23 October 2026; revised on 25 October 2026. Status: architecture correction implemented and verified in the working tree. External-file Worker loading in NW.js remains blocked by the host. See the [UI specification](EngineManagementUiDesign.md) and [clickable preview](design/EngineManagement.html).

The [NW.js spawned-process correction](ArchivedPlans/NwjsProcessOwnershipFixPlan.md) and [browser engine dependency correction](ArchivedPlans/BrowserEngineDependencyFixPlan.md), including the native inheritance follow-up, are implemented and verified. This plan starts from that completed runtime architecture. The working tree contains the earlier package implementation. This plan itself introduced the invalid concrete-manager inheritance and platform-owned service-worker entry; the defect was not only implementation drift. The user rejected those additions and requested a redesign on 25 October 2026, then explicitly instructed cleanup and implementation. The corrected architecture is now implemented; its own verification evidence and the independent external desktop Worker host limitation are recorded below.

Both process managers already return an IProcess reference, stored in IAssignedEngineRuntime.process. NW.js returns the original spawned process with UTF-8 output streams. BrowserProcessManager returns markRaw(new BrowserWorkerProcess(worker)); that wrapper privately adapts Worker commands, output and managed closure to IProcess. Its constructor takes only the Worker. The manager's _processes set exists only for disposal, not reference lookup.

NwjsUciEngineClient and BrowserUciEngineClient already inherit UciEngineClientBase. The base owns UCI operations, sessions and process I/O; in the completed baseline, subclasses implement only _isProcessOpen and _getProcessExitDetail. Each platform store constructs its plain client with markRaw and returns the same instance through IEngineClient. Preserve this composition and direct process ownership: no per-client Pinia store, binding facade, transport resolver or process registry is required. NwjsUtility retains native host access/liveness; shared line I/O belongs to the base.

The package rework changes the registered client enum and launch-path selection described below. It does not reintroduce handles or redo either completed correction, and adds no EngineRuntimeService public API. Existing package, profile and UI decisions remain unchanged.

The app has never been released. Update the current schemas and fixtures directly, keeping the initial schema version. Do not add migrations, compatibility readers, old-field conversions or runtime aliases.

The [detailed API](#detailed-api) and [function flows](#function-flows) below describe the additions and changes required by this rework. Existing EngineRuntimeService APIs and lifecycle remain defined by the [runtime ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md); they are not being redesigned here. This plan retains the reviewed API and stacked function-flow design alongside implementation evidence.

## Architecture correction: explicit changes for review

The user directed that NwjsProcessManager build on private shared implementation, with no separate NwjsWorkerProcessManager. Stored-file loading must stay local to the process manager. On disposal, unregister its stored-file service worker. These choices supersede the earlier concrete inheritance and retained-registration policy.

The earlier plan added both rejected structures without properly surfacing their architectural impact in conversation. They are explicit removals below, not silently renamed target services.

| Change | Implementation delta |
| --- | --- |
| Add private shared implementation | src/platform/base/WorkerProcessManagerBase.ts holds existing Worker mechanics. Both concrete managers derive independently. No new architectural interface/service. |
| Change existing NW.js implementation | src/platform/nwjs/NwjsProcessManager.ts becomes a plain class supporting native and Worker bindings through EngineClientType. Remove defineNwjsProcessManagerStore and update platform/journey construction directly. |
| Remove extra desktop manager | Delete src/platform/nwjs/NwjsWorkerProcessManager.ts. Move its URL hook into NwjsProcessManager. No concrete NW.js-to-browser-manager dependency. |
| Keep each loader local | A private StoredWorkerUtility instance owns that manager's native registration operation, registration reference and temporary control listeners. No global loader singleton/registry. |
| Change concrete disposal | dispose becomes awaitable: cancel startup, close its Workers, await loader cleanup/unregistration, including late native registration results. IProcessManager/EngineRuntimeService gain no API. |
| Encapsulate worker-side events in the library | Add src/utility/StoredWorkerServer.ts, a library-private class with start/dispose and stable instance-owned activate/fetch handlers. No platform-layer serving service. |
| Remove platform bootstrap | Delete src/platform/browser/StoredFileServiceWorker.ts. Minimal src/utility/StoredWorkerEntry.ts starts the generic binding only inside the browser-created context. Main-app imports attach no worker-global handlers. |
| Generalise build integration | Replace the engine-specific dev asset helper with configured build/StoredWorkerAssets.ts. Both builds emit the generic library entry; worker source imports no app configuration. |

The private library adds dispose; its worker-side object has start/dispose. Configuration transport passes the existing databaseName/storeName/rootPath as registration-script URL parameters. The worker reads its browser registration scope for the app base. This crosses the native execution boundary without app-config imports, a new record or a message handshake; it changes no engine protocol.

All additions/removals and implementation-level API changes are listed here. The user authorised their implementation on 25 October 2026. Package names, frontend checks, storage keys, routed UI and EngineRuntimeService boundaries remain unchanged. The affected implementation, tests/build wiring and low-level ownership notes now reflect this correction.

## Questions to answer before implementation

Decisions confirmed by the user on 24 and 25 October 2026:

1. **Included engine:** load directly from app-shipped package files. Do not copy it into browser package storage. It appears as an ordinary available package/default profile and uses the matching engine client.
2. **Import destination:** the installed engine name is its folder name. The import view has an Engine name input with folder-name character validation. The name is separate from any profile name and the vendor's archive filename.
3. **Uniqueness:** installed engine names must be unique. The frontend checks its loaded engine list and blocks a duplicate name. These answers do not authorise a separate in-place replacement workflow.
4. **Versions:** no separate version field or upstream name/version discovery. Display the folder name as the engine name. Users may include a version in that name themselves.
5. **Stored-script loading:** use a service worker to serve browser-stored package files at ordinary same-origin URLs, preserving their relative layout.
6. **Removal protection:** check accepted profiles, draft profiles and open-game assignments only. Temporary engine operations do not add a removal guard or tracking subsystem.
7. **Reusable library:** a generic capability for loading locally stored JavaScript and assets in Workers is valid private utility support. It must contain no chess-engine policy or engine-specific dependency.
8. **Desktop manager:** no NwjsWorkerProcessManager; NwjsProcessManager can derive private shared implementation.
9. **Local ownership:** the process manager owns its private loader and registration lifecycle, without an independently initialised platform service-worker module.
10. **Disposal:** unregister the stored-file service worker on process-manager disposal.

The listed questions have been answered. The user explicitly resumed implementation on 25 October 2026. The selected service-worker URL mechanism now has local ownership and awaited unregistration on manager disposal.

## Installed engine names

Use the Engine name as one folder component, preserving the entered name in storage and display. The frontend import view owns both name-format and uniqueness validation, using its already loaded engine list, and enables Install only for a valid, unique name after successful folder discovery. The view awaits its own discovery action on direct entry and keeps Install disabled during loading or after discovery failure; an empty/stale list is not evidence that a name is available. EnginesStore and EnginePackageService receive the validated name without repeating either check. The list includes the built-in folder, whose name is also unavailable. Profile labels remain independently editable.

Reject an empty/whitespace-only name, . or .., path separators, control characters, the characters `< > : " / \ | ? *`, and a trailing space or dot. Also reject reserved device names such as CON/NUL/COM1/LPT1, including their extension forms. Unicode names, spaces within names, hyphens and version text remain usable. Compare engine names without case differences so Stockfish and stockfish do not become duplicate-looking entries. These validation rules follow [Windows folder-name constraints](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) while keeping the user-supplied name.

## Stored-script loading options

The selected mechanism remains service-worker package URLs. Stored original JS/WASM/neighbouring assets are served under the reserved app-relative namespace, for example /engine-files/Example/main.js. IndexedDB bytes have no ordinary fetchable path by themselves; the generic library answers these requests without changing filenames, layout or bytes. Ordinary app/bundled files retain their current paths.

The process manager owns a private loader instance. The first stored launch starts it lazily, sharing one _packageRegistration readiness promise with concurrent/later launches on that manager. Discovery/import/profile editing create no registration or engine Worker. Successful readiness is reused until manager disposal. Actual failure reaches its callers and permits a later explicit attempt. Add no timer, process-ready wait or automatic long-wait cleanup.

A generic library object owns the fetch/activate handlers in the browser's service-worker context. Its minimal entry imports only library code and obtains plain configuration from registration; it imports no app config, engine contract or platform/domain/store module. The build emits the generic asset at the configured app-base URL.

Await matching activation and control of the creating document before constructing a stored engine Worker. The loader owns temporary state/controller listeners and detaches them when control, actual failure or cancellation settles the wait. Worker-side object handlers filter the reserved namespace and synchronously provide response promises. See the [native fetch-event boundary](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).

An individual stop closes only that engine Worker. Manager disposal aborts startup, closes its own live Workers and awaits loader unregistration. Native register is not cancellable: observe a late result, unregister it and prevent any engine Worker from starting after disposal.

Unregister is a browser-level request, not synchronous destruction of another JavaScript context. Existing controlled clients can delay clearing the worker. Do not promise instant removal of all browser-owned listeners/controllers. The user-selected policy still requests and awaits unregistration instead of deliberately retaining it after manager disposal. No cross-tab registry, reference-count system or broadcast shutdown protocol is added. See the [unregister/clear lifecycle](https://www.w3.org/TR/service-workers/#try-clear-registration-algorithm).

Keep the served script filename under the app base and the initial files-store format. Add no app-shell cache, offline policy, metadata catalogue, server fallback or Blob rewriting.

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

The loader must preserve or explicitly support the build's relative imports, WASM/NNUE resolution, MIME types and host requirements. Do not assume every vendor entry accepts an app asset-map bootstrap or that Blob workers inherit a package directory. Verify actual Stockfish and an independent Worker through the selected serving mechanism. See [Worker construction](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) and [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

Load original app/file URLs and service-worker-served file URLs directly. The process manager owns each Worker and its closure. Never save process/Worker objects or picker handles in profiles.

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
| Asset preparation | The concrete manager resolves the exact entry URL and owns the Worker and its private stored-file loader. The generic library owns byte-serving support inside the browser-created context. Derive the package boundary from its virtual path, not a registry id. |

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

The file-serving service worker now reads through the generic library directly, so remove the proposed EnginePackageService.readFile API. Resolve the existing picker dependency only inside browseEngineFile. This adds no runtime/platform API or dependency from the generic library into an engine service.

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
  private readonly _storedFiles: StoredWorkerUtility;
  private _packageRegistration?: Promise<void>;
  private _registerPackageServiceWorker(): Promise<void>;
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

The base is private implementation support, not another composed platform interface or flow owner. It imports no concrete host manager/client/store. Keep its process set, lifetime signal, loader and readiness promise private. Only the existing URL hook is protected. BrowserProcessManager inherits the current same-origin default; NwjsProcessManager overrides native/app URL conversion.

Each platform store registers cleanup of its exact manager instances with onScopeDispose. Concrete dispose becomes awaitable for registration cleanup; it is not added to IProcessManager. The callback starts that work and explicitly observes rejection; Vue/Pinia does not await scope callbacks. Tests await the returned promise. Native shutdown and unrelated close policy remain unchanged.

### Private call-depth correction

The call-depth correction remains required. The preceding implementation was rejected for ownership and inheritance violations. The user subsequently authorised this correction; application changes are limited to the explicit implementation delta and corresponding ownership notes.

Have public actions orchestrate the work and call leaf helpers directly. spawnProcess owns the lazy-registration cache branch and each process's launch. _registerPackageServiceWorker is a leaf adaptation of generic library work, without another manager-private method. Count protected overrides, module helpers and delegating local callbacks when reviewing call depth; moving a relay elsewhere does not flatten it. Do not introduce private-to-private delegation solely to meet the preferred function length, or add forwarding methods and cleanup relays.

spawnProcess resolves the entry, lazily creates or reuses _packageRegistration for a stored entry, awaits that shared promise, then constructs the Worker. _registerPackageServiceWorker is called only when no cached operation exists; the generic library observes service-worker control.

Planned changes to the partial implementation:

- Remove _prepareEntry and its returned preparation object. spawnProcess directly sequences URL resolution, stored-path detection, lazy shared registration and Worker construction.
- Remove _ensurePackageServing, _registerPackageServing and _waitForPackageControl. spawnProcess directly owns lazy creation/reuse of _packageRegistration. One leaf _registerPackageServiceWorker operation adapts generic library registration to the existing platform-error contract.
- Replace manager-level _serving/_registration fields with _packageRegistration?: Promise<void>. The private loader retains the actual native registration operation/reference for disposal; the manager caches readiness for subsequent processes.
- Remove EnginePackageUtility and its _leases/_deletions sets, acquisition/deletion claims and release callbacks from the partial implementation. Keep profile/game reference checks only, without a replacement tracking owner or API. Reusable pure path transformations may remain private library support, without flow-owner rows.
- Remove _startError and _invalidEntry wrappers. Construct the existing PlatformError at the failure site, retaining its error contract.
- Put generic registration/control observation and listener cleanup inside the reusable library. Keep lazy promise ownership and platform-error adaptation in the manager. No engine-ready callback or cleanup relay.
- Remove the readiness timer and controlWaitMs configuration from the partial implementation. A pending control wait stays pending until readiness, an observed failure or manager disposal.
- Keep listPackages/install/remove as engine-specific orchestration points that issue private generic library file operations directly. Remove _withFiles, _listStoredPackagePaths, _readPackage and _listStoredFiles. The reusable library owns generic database/transaction details while preserving storage format and completion semantics.
- Remove the _readAction forwarding callback from package refresh. Pass _readPackages directly to the existing queue helper.

| Retained owner/helper | Direct responsibility |
| --- | --- |
| `BrowserProcessManager.spawnProcess(entryPath, args)` | Orchestrates URL resolution, lazy creation/reuse of the shared registration promise, then this process's Worker. Owns construction failure cleanup and removal from the disposal set on exit. Returns without waiting for engine initialisation. |
| `BrowserProcessManager._resolveWorkerUrl(entryPath)` | Protected host hook resolving and validating the actual URL. No preparation, registration or error-factory calls. |
| `NwjsProcessManager._resolveWorkerUrl(entryPath)` | Uses existing NodeUtility path/URL access for native paths and the actual app URL. No copying, installation or injected resolver. |
| `BrowserProcessManager._registerPackageServiceWorker()` inherited privately | Adapts its own loader's registration to app base, lifetime and error contract. The same inherited body serves NwjsProcessManager's Worker binding, without a concrete peer call. |
| `NodeUtility.getNodeUrl()` | Exposes the Node url module through the existing loading/override boundary, alongside getNodePath/getNodeFs. |
| `EnginesStore._queuePackageWork(action)` | Serialises actual package reads/writes with a settled queue tail. |
| `EnginesStore._readPackages()` | Calls service.listPackages and replaces the transient list after success. Called directly inside queued actions. |
| `EnginePackageService._decodeArchive(file, signal)` | Decodes original ZIP paths/bytes. No entry selection, destination or writes; keep validation/cancellation callbacks shallow. |
| `EnginePackageService._validatePackageFiles(archive)` | Validates the decoded file set and path boundaries/conflicts. No name validation or manifest. |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` | Reports current profile/game reference names. remove issues its file transaction after this check. |
| `EnginePackageImportView._validateEngineName(name)` | Frontend format and uniqueness checks against the loaded list. |
| `EnginePackageImportView._refreshPackages()` | Owns the discovery-ready gate and actual pending read; calls the store action directly. |

### Reusable stored-file Worker library

This is self-contained implementation support for ordinary stored JS/assets, with no app contracts/configuration/services/stores or concrete platform-manager imports. Retain IndexedDB's existing database/store/compound keys and initial schema. The manager owns its execution loader as a private instance field; importing the library or constructing it performs no IO and installs no global listeners.

~~~ts
interface IStoredWorkerConfig {
  databaseName: string;
  storeName: string;
  rootPath: string;
  serviceWorkerPath: string;
}
interface IStoredWorkerFile {
  path: string;
  data: Uint8Array<ArrayBuffer>;
}
class StoredWorkerUtility {
  constructor(config: IStoredWorkerConfig);
  listRoots(): Promise<readonly string[]>;
  listFiles(root: string): Promise<readonly string[]>;
  writeFiles(root: string, files: readonly IStoredWorkerFile[], signal?: AbortSignal): Promise<void>;
  removeFiles(root: string): Promise<void>;
  resolveUrl(entryPath: string, appBaseUrl: URL): URL;
  isStoredUrl(url: URL, appBaseUrl: URL): boolean;
  register(appBaseUrl: URL, signal?: AbortSignal): Promise<void>;
  respond(request: Request, appBaseUrl: URL): Promise<Response>;
  dispose(): Promise<void>;
}
~~~

| Library operation | Generic responsibility |
| --- | --- |
| listRoots/listFiles | Read file keys only, projecting opaque roots and original relative paths. |
| writeFiles/removeFiles | Validate generic paths, await atomic transaction completion/abort and close database connections. No engine name/reference rules. |
| resolveUrl/isStoredUrl | Encode components, retain hierarchy and identify the configured namespace. NW.js file conversion stays in its manager. |
| register | Retain this instance's actual native registration promise before awaiting it; configure the generic entry and await matching document control. Cancel/detach only its owned temporary listeners. No global cache or timer. |
| respond | Return exact original bytes with MIME/no-store and explicit malformed/missing/method/storage errors. No app HTML, substitutions or engine startup bridge. |
| dispose | Cancel this instance's control wait, detach its owned listeners, observe in-flight native registration and await unregister on its resulting registration. No registration means no registration/file work. |

Instance state may include a lifetime AbortController and the actual Promise<ServiceWorkerRegistration> returned by native register. That promise retains a resource operation for late-result cleanup; it is not a second readiness cache. The manager owns the shared readiness promise. A rejected native registration creates nothing to unregister and remains a launch failure. Preserve the owned registration reference if unregister itself rejects so an explicit cleanup retry can still reach it; repeated cleanup is harmless.

The existing optional signal still cancels the registration/control wait. Loader disposal settles its wait even when no external signal was passed. Use one terminal state callback to detach that wait's listeners and settle; no finish/cleanup relay, generation guard or deadline. Native register cannot be cancelled: retain its actual promise and unregister a result delivered after disposal.

The worker-side binding is an object inside the same private library:

~~~ts
class StoredWorkerServer {
  constructor(config: IStoredWorkerConfig, scope: IStoredWorkerScope);
  start(): void;
  dispose(): void;
  // Private scope, byte responder and stable instance-owned activate/fetch handlers.
}
~~~

IStoredWorkerScope is a library-private description of the native event target, clients and registration scope. start attaches this object's handlers once. Its activate handler supplies clients.claim through waitUntil. Its fetch handler filters the namespace and synchronously supplies the response promise. dispose removes those exact handlers from that same scope. Serving has no free module-level handler functions or module-level addEventListener effects.

The minimal src/utility/StoredWorkerEntry.ts runs only when the browser creates the service-worker context. It reads and validates databaseName/storeName/rootPath from its script URL, uses self.registration.scope for the app base and starts one StoredWorkerServer. It imports no application module, creates no registration and is not imported by the main app. Its only role is the native execution entry into that library object.

The manager's loader and the worker-side binding live in separate JavaScript contexts. They are not one synchronously callable object. Manager disposal releases its registration through the loader; the browser determines when an already-controlled worker context can terminate. Do not add a global message listener or claim that the manager directly calls the remote object's dispose. Object ownership encapsulates handlers; unregister requests browser-resource release.

The register implementation sets URLSearchParams on the configured script URL for the three existing storage values. The worker reconstructs them whenever the browser starts it. No application config import, saved configuration catalogue or message-initialisation queue is added. Invalid/missing generic configuration fails actual registration. serviceWorkerPath stays a normal caller-supplied value; inside the worker its own current URL supplies that field.

Generalise build/StoredWorkerAssets.ts to accept the served script path and serve/emit the generic entry for dev/production. Keep the configured app-base filename so no extra hosting-scope policy is required. This is build integration with a library asset, not an application/platform serving module.

EnginePackageService uses its own storage-only instance for discovery/import/removal; these paths never register anything. The manager keeps its execution loader private. Neither instance refers to the other. Engine policy remains in the domain service; package APIs gain no prepare/serve/register operation.

The library retains generic database/transaction leaves and shallow URL/file helpers. Under the [utility contract](LowLevel/Architecture/UtilityIndex.md#purpose), neither library class nor its native entry is an architectural flow owner. Review their private operations here; concrete service/manager/platform callbacks remain the owners in the stacked function tables.

### Corrective review before resuming

Review the whole rework as one design against every newly introduced manager/service/store/view helper and meaningful local callback. Verify public orchestration in spawnProcess, listPackages, install, remove and refreshPackages together; individual cleanup decisions do not replace that review. Do not limit review to _resolveWorkerUrl or refactor existing EngineRuntimeService/UciEngineClientBase.

| Entry | Deepest intended internal path |
| --- | --- |
| Worker spawn | spawnProcess orchestrates lazy registration and creation; _registerPackageServiceWorker is a leaf adaptation of private library work; later spawns reuse the promise |
| Host URL resolution | spawnProcess -> _resolveWorkerUrl -> existing path/module support |
| Package storage/discovery | public package action owns engine rules and issues private library file operations directly, without engine-specific storage helper chains |
| Package refresh | refreshPackages passes _readPackages directly to _queuePackageWork; _readPackages calls the public service boundary |
| Stored-file serving | The concrete manager owns its loader; worker-side instance handlers stay inside private library/native-boundary support, with no platform service-worker flow owner |

Promise executors/continuations stay with their actual operation; do not extract extra routing helpers around them or hide further chains inside callback rows. The terminal readiness/transaction callbacks remove listeners and settle themselves. Preserve the agreed public APIs, storage model, host bindings and runtime behaviour. The implementation and verification follow the paths above.

### Existing runtime boundary

EngineRuntimeService has no API changes in this plan. Its unchanged signatures and lifecycle are not reproduced in this API design. Existing [runtime ownership](LowLevel/ProcessFlows/EngineRuntimeOwnership.md) and [engine-client contracts](LowLevel/Architecture/PlatformAbstraction/EngineClient.md) remain authoritative. Only the internal substitutions explicitly listed under [Implementation boundary](#implementation-boundary) are in scope.

Existing EnginesStore profile-selection and option-discovery APIs also retain their signatures and behaviour. Their launch-field/cache comparisons use entryPath and clientType and drop protocol as already specified. Package operations do not wrap or replace getOptions. No new cancellation parameter is added to spawnProcess or option discovery.

### Open API decisions

The first-use, naming, uniqueness, metadata and service-worker decisions are recorded in [Questions to answer before implementation](#questions-to-answer-before-implementation). The listed choices are settled. The removal decision is also settled: accepted/draft profiles and open games are the only removal checks. Package installation creates a unique named folder; there is no implicit replacement or separate version policy. The selected loading mechanism and ownership correction are implemented. The external desktop Worker host limitation remains recorded below.

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

### Worker creation and stored-file serving

The native-configured NwjsProcessManager retains its actual spawn/UTF-8/liveness/exit-wait bodies. Refactoring its implementation ownership does not change those operations. The Worker-configured instance delegates to the shared base on this same object, with its native URL hook. No concrete browser manager is constructed or called by NwjsProcessManager.

| `NwjsProcessManager.spawnProcess(entryPath, args): Uci branch` |
| --- |
| `childProcess.spawn(entryPath, args, { stdio: 'pipe' })` |
| `process.once('spawn', _handleSpawn)` |
| `process.once('error', _handleError)` |

| `NwjsProcessManager.spawnProcess: existing _handleSpawn callback` |
| --- |
| `process.stdout.setEncoding('utf8')` |
| `process.stderr.setEncoding('utf8')` |
| `_cleanup()` |
| `markRaw(process)` |

The existing startup callback resolves with that exact native process. _handleError removes those temporary startup listeners and rejects through the existing native process-start contract. Retain both callback bodies; introduce no new native flow or registry.

| `NwjsProcessManager.spawnProcess(entryPath, args): UciWorker branch` |
| --- |
| `super.spawnProcess(entryPath, args)` |

This calls inherited code on the same instance. It does not call BrowserProcessManager. Its URL hook is NwjsProcessManager._resolveWorkerUrl; its loader, readiness promise, lifetime and Worker disposal set belong to this instance. The inherited implementation is expanded using the browser concrete-owner headers below, without introducing the base as another architectural flow owner.

| Resource | Scope and owner |
| --- | --- |
| Stored-file loader | One private instance field per manager; no module/global singleton. Owns native registration work, the resulting reference and its temporary control callbacks. |
| Browser registration | Native resource reached through that loader. It may be reused by the browser for the app scope; the manager explicitly requests unregistration on disposal. |
| _packageRegistration?: Promise<void> | One private readiness promise on this manager. Concurrent stored launches await it; success is reused only during this manager's lifetime. |
| Engine Worker/process | One per spawn. Each process closes independently and removes itself from its manager's disposal set through its exit listener. |
| UCI initialisation | Existing client/runtime ownership; spawn adds no script/WASM/UCI readiness wait. |

Browser scope sharing does not create an app-global loader owner. Local pending waits/process sets remain independent; unregistration is still a browser-scope operation, with native effects described in the loading section. No registry/ref-count layer is introduced to disguise that boundary.

Individual engine stop retains this manager's loader for remaining/later engines. Manager disposal ends that ownership, cancels startup and awaits unregistration, including a native registration result delivered late. Replacing/reloading a manager creates a new local owner; it does not reuse a JavaScript singleton.

Public orchestration. Resolve/classify the target within spawnProcess using private path-mapping details, await shared registration for stored files, then construct and return this process.

| `BrowserProcessManager.spawnProcess(entryPath, args)` |
| --- |
| `_lifetime.signal.throwIfAborted()` |
| `this._resolveWorkerUrl(entryPath)` |
| `this._registerPackageServiceWorker()` only for a stored entry when _packageRegistration is absent |
| `await _packageRegistration` for a stored entry |
| `_lifetime.signal.throwIfAborted()` after the shared registration wait |
| `new Worker(url, { name: 'ChessVue UCI' })` |
| `new BrowserWorkerProcess(worker)` |
| `markRaw(process)` |
| `process.once('exit', _onProcessExit)` |

Reject unsupported arguments before work. Resolve the URL before deciding whether it belongs to stored files. spawnProcess directly owns the lazy-cache branch: assign the complete registration promise before yielding, await it, then create this process. The registration helper performs the one registration operation; it does not select an entry, check the cache or construct an engine Worker.

Retain successful _packageRegistration completion for the manager's remaining lifetime. Further stored launches use it without calling register again or attaching another control listener. If registration genuinely rejects, clear the cached promise in its rejection continuation and propagate that error to all current callers. Only a later explicit launch starts another attempt. The shared operation cannot be replaced while pending, so no sequence counter or promise-identity guard is needed.

After the last shared wait, check disposal before Worker construction. There is no further await before registering its exit listener and adding it to the disposal set. Construction failure terminates any created Worker. Return the same raw IProcess. Worker construction remains direct, without an injected factory, preparation object or creation helper.

Return after creating the process; do not wait for the engine script, WASM or UCI handshake to finish. The [Worker's built-in message queue](https://html.spec.whatwg.org/multipage/workers.html#worker-processing-model) accepts commands while its script starts, and the unchanged UCI client/runtime retains its existing initialisation sequencing. No application command queue or process-ready callback is added.

App-shipped or desktop file branch:

| `BrowserProcessManager.spawnProcess(entryPath, args): ordinary-file branch` |
| --- |
| `_lifetime.signal.throwIfAborted()` |
| `this._resolveWorkerUrl(entryPath)` |
| `new Worker(url, { name: 'ChessVue UCI' })` |
| `new BrowserWorkerProcess(worker)` |
| `markRaw(process)` |
| `process.once('exit', _onProcessExit)` |

Use the actual URL directly, skipping the lazy registration promise. No service-worker registration, IndexedDB read or desktop file copy occurs. appBaseUrl derives from document.baseURI and import.meta.env.BASE_URL, not the filesystem working directory.

The host hook resolves native paths to file URLs before stored-path classification, so a path cannot enter IndexedDB merely because its text resembles the managed namespace. Bundled profiles use app-relative filenames without a leading filesystem separator. Remove the old Stockfish alias.

Browser URL branch:

| `BrowserProcessManager._resolveWorkerUrl(entryPath)` |
| --- |
| `new URL(entryPath, appBaseUrl)` |

Retain same-origin HTTP(S) checks and existing rejection of local filesystem/executable targets. Remove the Stockfish alias mapping; the default profile supplies its real app-relative script path. Browser-stored paths take the separate virtual-file branch below.

Desktop absolute-filesystem branch, selected before URL parsing:

| `NwjsProcessManager._resolveWorkerUrl(entryPath)` |
| --- |
| `NodeUtility.getNodePath()` |
| `path.isAbsolute(entryPath)` |
| `NodeUtility.getNodeUrl()` |
| `nodeUrl.pathToFileURL(entryPath)` |

Use the host's path rules for drive-letter, UNC and POSIX absolute paths. For example, D:/Chess Engines/lozza.js becomes file:///D:/Chess%20Engines/lozza.js on Windows. Node's [pathToFileURL](https://nodejs.org/api/url.html#urlpathtofileurlpath-options) performs path conversion and URL escaping; do not feed a Windows path directly to new URL, prepend file:// by hand or turn a POSIX path into an app HTTP request. The profile retains the original filesystem path, and sibling resources resolve against the resulting file URL.

Desktop app-relative/explicit-URL branch:

| `NwjsProcessManager._resolveWorkerUrl(entryPath)` |
| --- |
| `NodeUtility.getNodePath()` |
| `path.isAbsolute(entryPath)` |
| `new URL(entryPath, appBaseUrl)` |

For non-filesystem input, resolve an app-relative entry against the actual app URL. Allow file URLs for local entries and the current app's chrome-extension URL for bundled files, comparing protocol and host explicitly for the extension scheme; same-origin HTTP(S) remains available when that is the app host. Reject other schemes or foreign web/extension origins through the existing process-start error. Absolute filesystem detection precedes this branch so a drive letter is never treated as a URL scheme. Keep these host details in the private desktop override; neither a host-specific public API nor a resolver callback is added.

URL conversion alone does not prove Worker loading permissions. Verify original scripts and sibling WASM/importScripts resources from outside the app directory in a real packaged NW.js node frame, as well as bundled app URLs. NW.js documents [node-frame privileges](https://docs.nwjs.io/For%20Users/Advanced/Security%20in%20NW.js/); this plan does not infer that a browser HTTP development page has the same file access. Do not add a local server, copy external files or change NW.js flags as an implicit fallback. Any additional host requirement must be raised before implementation proceeds beyond this verification gate.

Browser-stored user package branch:

| `BrowserProcessManager.spawnProcess(entryPath, args): first stored launch` |
| --- |
| `this._resolveWorkerUrl(entryPath)` |
| `this._registerPackageServiceWorker()` |
| `await _packageRegistration` |
| `_lifetime.signal.throwIfAborted()` |
| `new Worker(url, { name: 'ChessVue UCI' })` |
| `new BrowserWorkerProcess(worker)` |
| `markRaw(process)` |
| `process.once('exit', _onProcessExit)` |

Assign the helper's promise, including its rejection cleanup, to _packageRegistration before awaiting it. Encode virtual path components during URL resolution, preserving the package boundary and relative hierarchy. Missing resources use normal launch errors; import and profile save do not probe them.

| `BrowserProcessManager.spawnProcess(entryPath, args): concurrent or later stored launch` |
| --- |
| `this._resolveWorkerUrl(entryPath)` |
| `await _packageRegistration` |
| `_lifetime.signal.throwIfAborted()` |
| `new Worker(url, { name: 'ChessVue UCI' })` |
| `new BrowserWorkerProcess(worker)` |
| `markRaw(process)` |
| `process.once('exit', _onProcessExit)` |

A concurrent launch waits on the same outstanding promise. A later launch reuses its successful completion. Neither repeats registration, creates its own registration owner or installs per-process service-worker listeners. After the shared prerequisite, launches proceed independently; they are not serialised behind other engine processes.

Lazy registration operation, called only by the public action's first-use branch:

This manager leaf awaits the generic library's register operation using its app base and lifetime signal, and translates actual failures into the existing ProcessStartFailed contract. It does not select the cache, construct an engine Worker or add another private method. spawnProcess owns the one cached promise and all subsequent launch steps.

Registration, activation/control observation and listener cleanup are generic library internals, not engine-process callbacks. One register invocation uses one terminal local state callback. If the matching activated worker already controls the document, it completes without listeners. Otherwise it stays pending until control, an actual failure or owner disposal, and removes its listeners when settling. There is no timer or wait-helper relay.

Native registration is not cancellable: the local loader retains its actual promise, observes the result and releases a registration received after disposal. Cancelling an engine assignment does not dispose the manager's shared loader. spawnProcess checks disposal after its readiness await and before construction. No process-manager/runtime cancellation parameter is added.

The public manager action owns the stored-file serving capability through its private loader. The generic library's object-owned worker-side handlers and bootstrap are specified under [Reusable stored-file Worker library](#reusable-stored-file-worker-library); they are terminal implementation support here, with no StoredFileServiceWorker flow owner or free module-level listeners.

The build only makes that library asset available at its configured URL. It starts no resource on import. The first stored spawn registers it through this manager's loader. Responses preserve original bytes, paths, MIME/no-store and explicit HTTP failures. Ordinary requests are not intercepted. No engine-domain read API, app-shell cache, file substitution, script rewriting or UCI bridge is added.

Observed engine Worker errors continue through BrowserWorkerProcess and the unchanged client/runtime. Its existing manager-owned exit callback removes the closed process from the local set. The shared browser registration is released at manager disposal, not individual process closure.

| `BrowserUciEngineClient constructor()` |
| --- |
| `super(EngineClientType.UciWorker)` |

| `NwjsUciEngineClient constructor()` |
| --- |
| `super(EngineClientType.Uci)` |

Both subclasses already exist and inherit UciEngineClientBase. Their constructors supply the new registered enum parameter; the existing _isProcessOpen and _getProcessExitDetail overrides are unchanged. Both retain inherited initialisation. The platform store constructs each client with markRaw and retains it in the corresponding enum-keyed binding. getEngineClient returns that same plain instance. No process registry, client Pinia facade, resolver injection or separate protocol discriminator is added.

The base's only package-rework change is that enum parameter and its private assignment guard/type. Existing handshake, option application, analysis/player operations, parsing, stop acknowledgement and session cleanup remain unchanged; they are not expanded here. BrowserWorkerProcess still turns stdin lines into Worker.postMessage(command), and string message events into stdout chunks for the base's existing line parser. Native streams continue through that same base I/O.

### Worker resource release

Existing runtime stop/restart/disposal reaches the process manager through its unchanged public signatures. Only its enum-keyed lookup changes in EngineRuntimeService. The manager adds cancellation for its shared registration/control wait. The existing process exit listener removes the closed process from the disposal set. stopProcess returns successfully for an already-stopped resource; its live-process shutdown sequence, restart sequencing and the wrapper's managed closure are retained.

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

After those synchronous steps, each action directly awaits its own private loader's dispose operation. That operation cancels/detaches its control listeners, awaits any actual native registration attempt and calls unregister on its result. Private imported-library work is terminal here, not another architectural caller table. The returned manager promise settles only after that resource cleanup. It does not acquire a public runtime/API role.

Construct processStartFailure directly with the existing ProcessStartFailed/operation=spawnProcess contract. Pending launch continues to observe its real native operation and rejects on disposal without constructing an engine Worker. Loader cleanup reaches a late registration result; it cannot lose the reference simply because the readiness cache's rejection continuation cleared _packageRegistration.

No registration attempt means no unregister call. Native register rejection means no acquired resource. An actual unregister rejection reaches the cleanup owner and leaves the reference available for explicit retry. Repeated disposal remains harmless. Platform scope callbacks observe cleanup rejection; tests await disposal directly. No timer, generation guard, shutdown broadcast, global lease or new store is added.

The native-configured instance does not add native child-process tracking or kill policy; existing runtime owners still release native processes. The inherited disposal set contains only Worker wrappers created by that instance.

Failed construction terminates any created engine Worker. Normal stop, observed failure and runtime cleanup retain the wrapper's managed exit behaviour. An individual stop does not unregister serving needed by other engines on this manager; manager disposal does. Awaiting unregister is not a guarantee that an already-controlled browser client loses its controller immediately.

## Current verification limits

The user authorised cleanup and implementation on 25 October 2026. The correction passes 925 unit/mounted-application tests across 106 files, all 27 normal-browser cases, and five affected scripted-engine journeys covering cleanup, crash/retry recovery, out-of-order analysis, malformed output and typed/empty options. The build passes the code audit, TypeScript projects and production bundling.

Focused coverage verifies local handler ownership, matching control/listener cleanup, manager-local startup sharing, disposal during native registration, awaited late unregistration, observable/retryable unregister failure and no late engine Worker creation. Tests also verify that both NW.js bindings use distinct raw instances of the same concrete class while retaining native process identity and shutdown behaviour. No new runtime API is introduced.

Real NW.js SDK v0.119.2 passes both UCI handshakes, exact native ChildProcess identity, UTF-8 streams, simultaneous native/bundled Worker analysis, independent Worker stop/restart with renewed analysis and awaited final disposal. The external-file restriction below remains separate; no workaround is added.

The production-preview check imports original Lozza, creates a routed profile and produces three analysis lines with unchanged served bytes and no page errors. The generic browser proof uses a different database, object store and URL namespace with original sibling scripts/binary assets, confirming configuration reaches the generic worker entry.

Current reports are under ignored node_modules/.cache/codex: EngineInstallationArchitectureUnit.json, EngineInstallationArchitectureBrowserSummary.json, EngineInstallationArchitectureJourneys.json, EngineInstallationArchitectureProduction.json and EngineInstallationArchitectureNwjs.json.

### Earlier verification

The following results describe the preceding implementation and are retained as historical evidence; the runs above verify the correction.

The earlier implementation passed the full 914-test unit/mounted-application suite with the repository's documented single-worker thread setup. Its final 18-test package/library/manager/store rerun passed before this architecture revision. The earlier code audit, TypeScript projects and production build passed. The 27-test normal-browser project passed, including original Stockfish import/reload, generic sibling scripts/assets, reference-only removal, failed discovery and actual transaction rollback. The affected journey run passed 52 of 55 cases; the two outdated default-inventory expectations were corrected, and the final seven-case targeted rerun passes, including all three previously failing cases. The analysis snapshot test now excludes runtime-only $ fields rather than serialising native timer/process state.

The earlier real NW.js SDK v0.119.2 run passed native Stockfish and bundled Stockfish Worker handshakes and simultaneous analysis, independent Worker stop while native analysis remains alive, Worker restart and final cleanup. External-file Worker creation is blocked: Chromium terminates the renderer with DWH_INVALID_SCRIPT_URL_ORIGIN (bad IPC reason 123). Reproduction with an external original Lozza script isolates the problem from Stockfish/WASM. External-file/WASM acceptance remains blocked; no host flags, copying, Blob bootstrap or local-server workaround is adopted without a separate user decision.

Stockfish's upstream entry decodes its own URL in a way that breaks its WASM request when the package name contains a hash character. Generic encoded names passed with the independent scripted Worker. Preserve original engine bytes and the agreed frontend name rules; this engine-specific limitation is not permission to rewrite entries or silently restrict names.

Verification artifacts are generated under ignored test-results: EngineInstallationUnit.json, NwjsEngineInstallationVerification.json, LozzaEngineInstallationVerification.json and ProductionEngineInstallationVerification.json. Original Lozza 12 HCE passes stored-browser handshake, analysis, stop/restart and a legal player move. A production-preview UI run imports its original ZIP, creates a routed profile and produces three analysis lines through the stable built service-worker URL, with unchanged served script bytes and no page errors.

The earlier implementation removed EnginePackageUtility/EngineArchiveUtility and the engine-domain service-worker dependency, but still introduced the platform bootstrap and concrete-manager dependency now rejected. The new target removes those structures, keeps local object ownership and unregisters on manager disposal. No leases, deletion claims, preparation object, timer, migration, catalogue or new EngineRuntimeService API is introduced.

## Current contract changes and delivery

Remove engine `protocol`, `EngineProtocol`, `engineProtocols` and `engineProtocolSchema` from contracts/schemas, copies/defaults, option-cache keys, imports/fixtures and the read-only Protocol row as the current EngineProfileModal form moves into the page editor. Retain unrelated `URL.protocol` checks. Update only references required by the specified launch-field, enum, default and protocol-removal changes in callers, fixtures and architecture examples. Preserve the [implementation boundary](#implementation-boundary); this does not authorise runtime API changes or surrounding refactors.

Keep settings, saved-game and unrelated session/layout documents at their initial schema version. The app is unreleased; change the current readers, writers, defaults and fixtures together. There are no migration helpers, version branches, alias mappings or compatibility representations. No package-manifest schema exists.

Profiles and assignments store the exact entry path, client type, label and options. Exports omit engine binaries and runtime state. Parsing a saved game does not start an engine or import package files. Missing files or a foreign-host path remain current-format availability errors with explicit relink.

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 0. UI review | Actual entry-file selection, desktop direct paths, browser-only import | Validated unique engine name/folder, no version field, no assumed entry filenames/manifests or desktop installation. |
| 1. Runtime proof | Real Stockfish plus an independent worker using upstream layouts | Direct bundled files and service-worker-served imports load their actual scripts/relative assets; initial control, reload, normal runtime operations and cleanup pass. |
| 2. Current contracts | Entry path, single client enum, source enum, protocol removal | Exact paths/options round-trip without installation ids or new package metadata. |
| 3. Package files | Generic stored-file library plus engine folder discovery/import/removal | No package writes on desktop, browser list reconstructs from files, the frontend blocks duplicate names using that list and cancelled/failed import publishes nothing. |
| 4. Composition/defaults | Matching client/resource owners, ordinary bundled files/profile | Native/browser runtimes coexist with isolated stop/crash/restart; default uses same loader. |
| 5. Acceptance | Forms, focused tests, browser/NW.js journeys and architecture docs | Exact entry selection, Apply/Cancel, recovery and reference checks; separate simulation from real runtime results. |

Acceptance criteria remain below. Current correction evidence, historical results and the independent external desktop Worker blocker are recorded above:

| Area | Required evidence |
| --- | --- |
| Reusable library and object ownership | Run a non-UCI Worker with stored sibling scripts/binary assets. Library/worker entry imports contain no app configuration, engine contracts, platform implementations, services or stores. Import/construct attaches no global listeners. start/dispose attach/remove only the worker-side object's own stable handlers. Verify configuration transport and original bytes. |
| Lazy registration | Concurrent stored spawns start exactly one registration/control operation and await the same promise. Later spawns retain successful completion without another register call or control listener. Actual rejection reaches current callers and clears the cache for a later explicit launch. Bundled/native-file entries skip it. |
| Manager-owned disposal | Dispose during native register, control wait or the continuation before spawn. No late engine Worker starts; own Workers close and local listeners settle/detach. Await unregister for a successful or late-delivered registration; no acquisition means no unregister. Keep actual cleanup failure observable/retryable. An individual stop keeps this manager's loader. No timer or global tracking. |
| Platform composition and native parity | No NwjsWorkerProcessManager remains. Both concrete managers derive only the private base; NW.js imports no concrete browser manager. Its existing enum configures native/Worker instances. Remove the Pinia manager factory and update journeys directly. Preserve native method bodies, raw process/UTF-8 guarantee and both UCI hooks. Await/observe concrete disposal; do not claim unregister gives cross-tab resource isolation. |
| Idempotent stop | Both managers return successfully for an already-stopped resource without waiting for another exit or killing it again. A live stop still subscribes before kill and awaits exit. Repeated stop after closure succeeds, and restart from a closed process still spawns the replacement. |
| Desktop entry URLs | Verify drive-letter/UNC/POSIX paths, spaces, Unicode, percent/hash characters, bundled app-relative entries and rejection of unsupported URLs. Real packaged NW.js loads a supplied entry outside the app directory with sibling scripts/WASM and ordinary analysis/play; URL-unit checks alone are insufficient. |
| Frontend discovery eligibility | A direct import URL with delayed/failed discovery cannot install. An empty successful read can enable a valid new name. A committed write followed by failed refresh keeps Install disabled; Retry only discovers files. A failed write requires discovery/name revalidation before another attempt. All name checks remain in the view. |
| Flow ownership, utilities and depth | Stacked tables retain architectural callers and meaningful callbacks; utilities are not flow owners or hidden coordination boundaries. Verify that removal uses only current accepted/draft profiles and open-game references; temporary work adds no tracking. Check the shallow call paths without forwarding/error/cleanup relays; runtime APIs remain unchanged. |

Cover unique/invalid engine names, folder-name display, ambiguous multi-build archives, Node-only metadata entries, helper-worker confusion, different layouts/names, absent scripts/assets, path traversal, external changes, missing/foreign-host paths, cancellation/disposal and ignored protocol removal. Run `npm run check:code`, focused Vitest suites, affected Playwright journeys and `npm run build` after implementation. These checks and real NW.js native/bundled mixed-engine acceptance pass for this correction. The external-file NW.js acceptance criterion remains blocked. Earlier results remain historical; the current runs above verify this architecture correction.
