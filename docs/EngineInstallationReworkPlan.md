# Engine targets, browser packages and profiles

Prepared on 23 October 2026; revised on 24 October 2026. Status: proposed design for review; implementation is stopped. See the [UI specification](EngineManagementUiDesign.md) and [clickable preview](design/EngineManagement.html).

The app has never been released. Update the current schemas and fixtures directly, keeping the initial schema version. Do not add migrations, compatibility readers, old-field conversions or runtime aliases.

The [detailed API](#detailed-api) and [function flows](#function-flows) below define callable owners, signatures, storage mutations, cancellation and cleanup for this rework. They supplement the existing [runtime ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md). Keep these details in this plan while the design is under review.

## Questions to answer before implementation

Decisions confirmed by the user on 24 October 2026:

1. **Included engine:** load directly from app-shipped package files. Do not copy it into browser package storage. It appears as an ordinary available package/default profile and uses the matching engine client.
2. **Import destination:** the installed engine name is its folder name. The import view has an Engine name input with folder-name character validation. The name is separate from any profile name and the vendor's archive filename.
3. **Uniqueness:** installed engine names must be unique. Reject a duplicate name instead of silently overwriting another engine. These answers do not authorise a separate in-place replacement workflow.
4. **Versions:** no separate version field or upstream name/version discovery. Display the folder name as the engine name. Users may include a version in that name themselves.
5. **Stored-script loading:** use a service worker to serve browser-stored package files at ordinary same-origin URLs, preserving their relative layout.

The listed questions have been answered. The [selected loading design](#stored-script-loading-options) and its function flows remain a plan for review; real-engine verification is outstanding. Implementation is stopped pending an explicit instruction to resume.

## Installed engine names

Use the Engine name as one folder component, preserving the entered name in storage and display. Validate before enabling Install and repeat validation in EnginePackageService; recheck uniqueness at the atomic write boundary so two imports cannot publish the same name. The built-in folder name also occupies its name in the engine list. Profile labels remain independently editable.

Reject an empty/whitespace-only name, . or .., path separators, control characters, the characters `< > : " / \ | ? *`, and a trailing space or dot. Also reject reserved device names such as CON/NUL/COM1/LPT1, including their extension forms. Unicode names, spaces within names, hyphens and version text remain usable. Compare engine names without case differences so Stockfish and stockfish do not become duplicate-looking entries. These validation rules follow [Windows folder-name constraints](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) while keeping the user-supplied name.

## Stored-script loading options

Selected by the user on 24 October 2026: **service-worker package URLs**. An app-owned file-serving service worker maps a reserved path under the app base, for example /engine-files/Example/engine.js, to the exact stored package file. Requests for neighbouring scripts/WASM/NNUE resolve within that same URL hierarchy, with original filenames and bytes. This is the selected architecture, not completed runtime proof.

The handler responds only to the reserved stored-engine path. Ordinary app requests, including bundled engine files, keep their normal network/app-file path. Package discovery/import and profile editing do not register the service worker or start an engine; registration/control readiness belongs to resource preparation when a stored engine is actually launched. A service worker can synthesise these file responses and leave other requests alone; see [fetch events](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).

The build must serve the app-owned service-worker script at a stable URL beneath the app base in development and production. Its registration scope covers the app page that creates engine Workers, while its fetch handler filters to engine-file URLs. Await the matching active registration and actual page control before creating a stored engine Worker. Registration requires a secure context; activation can [claim clients](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim), and [controllerchange](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controllerchange_event) confirms control. A bare [ready promise](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/ready) is not a bounded failure-handling strategy.

Use one shared, owned readiness operation with listener/timer cleanup, a bounded wait and retry after failure. Unsupported registration, failed activation or failure to obtain control becomes the existing process-start error; do not launch through an unready virtual URL or introduce a Blob/server fallback. Host disposal settles pending readiness work. Stopping an individual engine releases its package lease and Worker, not the shared service-worker registration. No app-shell cache, offline policy, installation catalogue or additional public engine API is introduced.

Keep the generic engine/package APIs and single EngineClientType selector. Real Stockfish plus an independent engine, relative assets, initial control without manual reload, reload, failed registration/read and cleanup remain required verification. Application implementation remains stopped.

## Scope

Enable browser profiles to select and load other engines using their supplied entry files. Reuse the existing initialisation, getOptions, analysis/player operations and cleanup. Package import stores files; it does not launch engines or classify their capabilities. Runtime lifecycle policy is unchanged.

## Agreed model

Desktop profiles point directly to an executable or the entry file inside a browser engine package, wherever the user keeps it. Browse uses the ordinary file dialog: navigate into the unpacked folder and choose the actual executable/script. There is no desktop installation, registration or engine catalogue.

- Browser import stores the supplied package files, preserving their relative layout. Discover imported packages by reading those folders, without separate installation records.
- Require neither a fixed entry filename nor a new manifest. Upstream archives do not generally contain a ChessVue manifest. Do not generate one during browser import or modify desktop folders.
- The engine name comes from its folder, not upstream package metadata. Ask for the entry/interface explicitly; never guess the first JavaScript file or assume an npm `main` is a Worker.
- Proposed engine APIs and data contracts stay generic across hosts: loadPackages, refreshPackages, listPackages, getPackage, browseEngineFile and IEnginePackage. browseEngineFile(startDirectory?) chooses an executable or entry-script file and returns its path, delegating to the existing IStorageAdapter.showOpenDialog contract. Capability checks expose available operations; concrete platform implementations handle storage, pickers and resource loading. No desktop/browser API families or host-discriminated DTOs.
- `EngineClientType` remains the single implementation selector. Remove the unused engine `protocol` field and `EngineProtocol` as part of the rework.
- Bundled Stockfish uses an ordinary package folder and a default profile naming its actual supplied entry file. It uses the same loader as user packages.
- Each assignment copies the profile's entry path, client type, name and options. Profile edits/deletions do not retarget existing games.

Follow [AGENTS.md](../AGENTS.md), the [cleanup ownership rules](ArchivedPlans/CodeCleanupPlan.md) and [store dependency boundaries](ArchivedPlans/StoreDependencyRestructuringPlan.md). Use explicit actions and lifecycle ownership, no watchers or async invalidation counters. State reaches platform capabilities through layer-2 services; stores do not look up sibling stores.

## Upstream interfaces and files

Documentation/source checked on 23 October 2026; entry files rechecked on 24 October. These are API findings, not runtime acceptance results.

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

Copy clientType/entryPath fields and a fresh options map into assignments. Keep the existing option-cache invalidation by client type/path, removing protocol from the comparison. Missing files use the existing runtime error handling; saving settings and assigning profiles gain no file checks.

## Package reading and entry selection

Preserve the upstream folder structure, script names and auxiliary resources. Browser import accepts the archive's actual layout; desktop users may extract it anywhere and point a profile at the executable/package entry. No required `assets` subdirectory or renamed entry is introduced.

1. Display the folder name and actual files, without reading package name/version metadata.
2. Ask the user to select the intended entry and implemented interface. Do not choose a helper worker merely because of its filename. Unsupported module APIs remain unsupported until the matching client/adaptation exists.
3. Save the explicit entry, implemented client type, profile name and configured options. Existing option discovery continues through getOptions.
4. Launch that entry with its required assets through the existing runtime path when the engine is used.

On desktop, selecting a target writes no package files. Browser import stores files without choosing an entry or client type. Create profile is a separate action that selects the entry and interface from the stored files. A package may have no profiles.

The loader must preserve or explicitly support the build's relative imports, WASM/NNUE resolution, MIME types and host requirements. Do not assume every vendor entry accepts an app asset-map bootstrap or that Blob workers inherit a package directory. Prove actual Stockfish and an independent worker before fixing the serving mechanism. See [Worker construction](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) and [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

A real resource lease retains worker/asset URLs until their consumers terminate. Release on failed startup, cancellation, crash, restart and disposal. Never save Blob URLs, workers or picker handles in profiles.

## Retrieval without a catalogue

| Target | Retrieval | Persisted data |
| --- | --- | --- |
| Desktop executable | Use the profile's exact executable entry path | Profile/assignment launch data and options |
| Desktop browser engine | Use the profile's supplied script path; resolve its required neighbouring/package resources | Profile/assignment launch data and options; no copy or registration |
| Bundled desktop engine | Same file reader and client, using the default profile's actual entry | Ordinary default profile |
| Imported browser package | Enumerate package directories/file keys; display the folder name | Original package files and relative layout |
| Browser engine profile | Resolve its exact virtual script path inside the discovered package folder | Profile/assignment launch data and options |

Browser storage can use a dedicated `chessvue-engines` IndexedDB database, with files keyed by `[packagePath, relativePath]`. Package-root keys define folder boundaries. Enumerate distinct roots and their filenames without loading WASM/NNUE bytes. A successful import contains files, so no independent folder/installation record is required. Add the app-shipped bundled folder to discovery without copying its files into storage. App-shipped/user roots determine the source enum. See the [IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Do not create an installations object store, catalogue singleton, generated package manifest or remembered-entry table. Desktop has no managed user-engine root to scan. Package discovery and import do not start engines. Existing option requests use getOptions; normal engine use retains existing readiness/error handling.

| Boundary | Responsibility |
| --- | --- |
| Generic package adapter | One IEnginePackageAdapter contract for file access, discovery and optional managed storage. Concrete implementations read desktop files or browser-stored files; canInstall identifies managed-storage support. |
| `EnginePackageService` | List package folders and candidate files using the folder name; isolate unreadable folders into warnings. No metadata parsing or native registration lookup. |
| `EnginesStore.loadPackages()` / `refreshPackages()` | Own/share discovery through the same API when the package list is opened and after explicit import/removal/Refresh actions. Direct-file adapters have no managed inventory to enumerate. Preserve profile drafts; no host checks, watchers or polling. |
| Profile/import target action | The existing file dialog returns a chosen file path; the profile form copies it into entryPath. Stored package files are selected directly from IEnginePackage.files. Archive input uses IEnginePackageFile (filename and original bytes), not File/Blob or a native picker handle. Validate archive paths/files through layer-2 services and own file-operation cancellation. |
| Assignment | Copy the selected profile through the existing game/player/analysis handlers. No new resolution API or preflight. |
| Asset preparation | Read the selected entry and required resources, acquiring a real lease. Derive browser package boundary from its virtual path, not a registry id. |

```text
Desktop profile -> executable entry -> native client/process
Desktop profile -> supplied JS entry -> matching browser client
Browser profile -> stored virtual entry -> same browser client
```

## Browser import and defaults

Only browser hosts need import/removal. EnginesStore coordinates file storage through EnginePackageService. EngineRuntimeService retains its existing operations for engines in use and temporary option discovery.

1. Collect the Engine name and validate its characters/uniqueness. An explicit import owns its picker and file operation; prevent duplicate starts.
2. Decode the archive and validate its paths/files. No entry/interface choice or generated manifest is required.
3. Publish all original files atomically in one IndexedDB transaction, preserving relative paths. No metadata/catalogue publication follows.
4. Refresh discovery. Failed/cancelled reads publish nothing. Settle an issued publication even if the initiating UI closes. Done retains files only; Create profile opens the separate Settings draft flow.

Cancel/settle superseded file reads before replacement work. Serialise conflicting publication/discovery. Browser package removal checks committed/draft profile entries, open-game assignments and active leases inside the folder. A draft-only profile deletion still blocks removal until Apply. Removal never touches desktop files or automatically rewrites profiles/games.

The build supplies Stockfish's original script/assets in a normal bundled package folder. Both hosts load that folder directly from app files. Its default profile names the actual entry and uses the matching client/resource-preparation boundary. Discovery includes it without copying, installing or restoring it into managed user storage. Managed removal applies to imported user folders. Remove the earlier proposed Restore included engine action and its restore-only APIs. Settings reset keeps its existing settings-only behaviour.

## Mixed runtime and UI

Host selection happens once. Its binding table is keyed only by `EngineClientType`, pairing each client with its matching lifecycle backend:

```text
EngineRuntimeService -> binding for engine.clientType
  Uci       -> native process manager -> engine.entryPath
  UciWorker -> package/file loader    -> engine.entryPath
```

Desktop offers native and supported browser bindings together, including within one game. Browser offers its implemented browser bindings. Preserve `getEngineClient(clientType)` and obtain the matching lifecycle backend from the same table, avoiding independent switches. Bind each opaque handle to its actual owner for stop/restart/disposal; do not parse handles.

Share the current UCI state machine through `IUciTransport` where appropriate, parameterising the hard-coded Uci guard while preserving ownership. Other interfaces can implement `IEngineClient` directly. Preserve turns, pondering, analysis stop acknowledgement, supersession, pause/deferred-result and legality semantics. Each assignment owns its runtime; share package bytes, not sessions. Verify actual [NW.js worker configuration](https://docs.nwjs.io/References/Command%20Line%20Options/) and packaging.

Desktop Settings shows profiles and behaviour. Add/Edit/Copy navigates to EngineProfileView through a Settings child route. Package import and details have their own routed views. SettingsView keeps the shared shell and mounts them with RouterView; the URL and route lifecycle own navigation. Direct links/reload and browser Back/Forward must work without opening the overview first. Use modals only for simple confirmations or single-choice pickers. Browse opens the existing file dialog for an executable or script. Browser adds the discovered package-folder list and import/remove controls, then profile entry selection. Both retain name/options and Apply/Save/Discard. Existing foreign-host/native targets remain visible and repairable. Profile deletion changes configuration only. Game selectors use accepted profiles and copy exact launch data/options.

Follow the [UI specification](EngineManagementUiDesign.md), existing `.vue` ownership and shared global CSS. No new watchers, component style blocks or scope escapes.

## Detailed API

The following additions are proposed, not existing application APIs. They implement the package-file and target-selection responsibilities above. The existing runtime API remains in place. Signatures are grouped by their actual owner, rather than introducing another facade or profile-resolution service.

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
loadPackages(): Promise<void>;
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
| `canInstallPackages()` | Settings/import views ask whether this adapter supports managed package writes | Synchronous capability only. Does not test storage health, permissions, file availability or engine compatibility. |
| `loadPackages()` | Overview, details and stored-file profile selection await initial discovery | Shares the actual pending read, or reuses an already loaded list. Rejects discovery failure so the view can offer Retry. |
| `refreshPackages()` | Explicit Refresh or retry rereads package folders | Replaces the transient list only on success; preserves the last successful list on failure. Does not change a profile draft. |
| `listPackages()` | Overview and profile file selector read the loaded folders/files | Synchronous read of current memory; no I/O. An empty result before load is not proof that storage is empty. |
| `getPackage(packagePath)` | Details and Create profile look up one loaded folder | Synchronous exact-path lookup, returning undefined when absent. No discovery, registration or fallback selection. |
| `browseEngineFile(startDirectory?)` | Profile Browse awaits the chosen executable/script path | Opens the existing file dialog through the service. Returns a path only; cancellation leaves the local form intact. |
| `readArchive(file, signal?)` | Import view supplies the selected filename/original bytes and receives a decoded file review | Reads/validates without storage writes. Rejects invalid files or cancellation. Does not choose an entry/interface. |
| `installPackage(engineName, archive, signal?)` | Import confirmation supplies the Engine name and decoded files | Validates the name, publishes to its unique folder, then refreshes. Returns packagePath for Create profile; creates no profile/installation record. |
| `removePackage(packagePath, readReferences)` | Confirmed removal supplies the folder and a current-reference reader | Checks references when its queued turn starts, deletes only stored package files and refreshes. Rejects blocked/failed deletion; it never removes profiles. |

Import, removal and discovery share the store's package-work queue, so a refresh cannot publish a list read before an issued mutation settled. Existing option discovery is not added to that queue. listPackages/getPackage read discovery results, not a persisted catalogue.

The removal caller supplies a function that reads current accepted/draft profiles and open-game assignments. Invoke it after queued work has settled, immediately before deletion, rather than keeping the list captured when Details opened. Presentation composes these inputs from SettingsStore and GamesStore; EnginesStore does not look up sibling stores. Active resource leases belong to the platform adapter/loader and are checked there.

### EnginePackageService additions

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
| `canInstall()` | EnginesStore.canInstallPackages delegates to the current package adapter's capability. Does not open a database or run a probe. |
| `listPackages()` | EnginesStore._readPackages requests folder discovery. Returns transient IEnginePackage values using folder names and per-folder warnings; rejects failure to enumerate storage. |
| `browseEngineFile(startDirectory?)` | EnginesStore.browseEngineFile delegates to IStorageAdapter.showOpenDialog, keeping the platform lookup out of the store. Propagates the existing picker result/cancellation. |
| `readArchive(file, signal?)` | EnginesStore.readArchive requests ZIP decoding and path/file validation. Returns IEngineArchive; writes nothing and starts no engine. |
| `install(engineName, archive, signal?)` | Queued import validates the name/files, derives the named folder, checks installation support and awaits adapter.installFiles. Returns the folder path; EnginesStore owns discovery refresh. |
| `remove(packagePath, references)` | Queued removal checks the supplied current references against the exact folder boundary, then awaits adapter.removeFiles. Does not read sibling stores or delete desktop files. |

This layer reaches storage through IPlatformService. Thin browse/capability delegations maintain the existing state-to-service-to-platform boundary; they are not separate workflows. None of these operations chooses an engine entry/interface, creates profiles, launches engines or persists discovery results.

### Generic platform package adapter

```ts
export interface IEnginePackageAdapter {
  canInstall(): boolean;
  listPackagePaths(): Promise<readonly string[]>;
  listFiles(packagePath: string): Promise<readonly string[]>;
  readFile(packagePath: string, relativePath: string): Promise<IEnginePackageFile>;
  installFiles(packagePath: string, files: readonly IEnginePackageFile[], signal?: AbortSignal): Promise<void>;
  removeFiles(packagePath: string): Promise<void>;
}
```

| Method | Service caller and storage responsibility |
| --- | --- |
| `canInstall()` | Service capability getter; reports whether managed import/removal is supported. A true result does not guarantee a later write succeeds. |
| `listPackagePaths()` | Service discovery reads distinct folder roots from stored file keys, plus the supplied bundled roots where applicable. Returns paths only; does not create folder/catalogue records. |
| `listFiles(packagePath)` | Service package reading enumerates relative filenames under one exact root. Does not load file contents or infer an entry. |
| `readFile(packagePath, relativePath)` | Resource preparation/serving reads original bytes for one file when needed. Discovery reads filenames only. Rejects missing/unreadable files without substituting another package. |
| `installFiles(packagePath, files, signal?)` | Service install supplies the validated named destination and original files. The transaction rejects an existing engine name before writing. Resolves on commit; actual abort/error publishes no partial folder. |
| `removeFiles(packagePath)` | Service removal deletes only that managed root after the platform owner checks active leases. Resolves after deletion settles; rejects unsupported, leased or failed deletion. |

The browser implementation enumerates file keys and reads original bytes. Removal and resource acquisition share the actual package owner: claim deletion before asynchronous file work, reject active leases and prevent acquisition during deletion. There is no persisted lease/installation table.

The desktop implementation reads actual files, including bundled files. It has no managed user-engine inventory; canInstall returns false and installFiles/removeFiles are unavailable. Pointing a profile at an external folder does not add it to listPackagePaths. Browsing a file remains the storage dialog operation below.

The bundled folder is read directly from the app distribution on both hosts. Its filenames come from the same build asset definition that supplies Stockfish scripts/WASM/licence files; no HTTP directory scan or vendor manifest is required. listPackagePaths/listFiles expose that folder alongside imported user folders without copying it. Resource preparation uses its ordinary app URLs, while browser-stored user files use the selected service-worker URL mapping. No restore-only file-batch API is needed.

### Existing platform interfaces

```ts
// IPlatformService: retain the existing client getter, change the manager
// getter to use the same binding, and add the package adapter getter.
getEngineClient(clientType: EngineClientType): IEngineClient;
getProcessManager(clientType: EngineClientType): IProcessManager;
getEnginePackageAdapter(): IEnginePackageAdapter;

// IStorageAdapter: existing contract, unchanged.
showOpenDialog(startDirectory?: string): Promise<string>;

// IProcessManager: existing lifecycle; only the path parameter wording changes.
spawnProcess(entryPath: string, args?: string[]): Promise<ProcessHandle>;
assertProcessHandleOpen(processHandle: ProcessHandle): void;
stopProcess(processHandle: ProcessHandle): Promise<void>;
restartProcess(processHandle: ProcessHandle, entryPath: string, args?: string[]): Promise<ProcessHandle>;
```

Both enum-keyed getters use one composition table pairing IEngineClient with IProcessManager. Desktop registers native and Worker pairs; browser registers its supported Worker pair. Unsupported types fail explicitly through existing error handling. A handle remains opaque and is used only with the pair selected for its owning assignment.

getEngineClient(clientType) returns the protocol/session owner; getProcessManager(clientType) returns the physical process/Worker lifecycle owner from that same pair. EngineRuntimeService calls both using the assignment's copied enum value. getEnginePackageAdapter returns the current host's file adapter to EnginePackageService. These getters return composed capabilities; none installs files, starts engines or resolves a profile.

The shared client factory's proposed parameter addition is also composition only:

```ts
defineUciEngineClientStore(
  storeId: string,
  clientType: EngineClientType,
  resolveTransport: (handle: ProcessHandle) => IUciTransport | undefined,
);
```

Platform composition supplies the registered enum value and matching registry lookup. The factory returns its existing Pinia store definition; the new parameter lets its assignment guard accept that instance's registered client type. resolveTransport looks up an already spawned opaque handle; it does not spawn or select an engine.

### Proposed private helpers

BrowserProcessManager owns _prepareEntry as a private method called only by spawnProcess. It resolves the actual script URL and retains its resources: app-shipped/desktop files use their real locations, and browser-stored files use service-worker readiness plus a package lease. Its result stays inside the process manager, which transfers the release callback to its Worker-close handler and releases on failed construction. This is not an injected entry-preparation callback, an IProcessManager operation, or an API on IPlatformService, EnginesStore or EnginePackageService. Platform composition supplies the underlying file/resource capabilities without exposing a prepare operation.

| Helper | Purpose and outcome |
| --- | --- |
| `BrowserProcessManager._prepareEntry(entryPath: string): Promise<{ url: URL; release(): void }>` | Private spawn helper. Returns the supplied entry URL and an owned resource-release callback; never persists either or chooses a profile. Preparation failure releases anything already acquired. |
| `EnginesStore._queuePackageWork(action)` | Serialises actual package reads/writes. Returns the action's result/failure while keeping a settled queue tail for the next action. No persistent jobs or new runtime queue. |
| `EnginesStore._readPackages()` | Calls service.listPackages and replaces the transient list only after success. Used inside queued actions so they do not queue themselves again. |
| `EnginePackageService._readPackage(adapter, packagePath)` | Builds one transient folder result from the folder name and actual filenames. Per-folder read failures become warnings. No metadata parsing. |
| `EnginePackageService._decodeArchive(file, signal)` | Uses the ZIP reader to turn original archive bytes into relative file paths/bytes. Returns files only; it does not infer a Worker, select a destination or install anything. |
| `EnginePackageService._validateEngineName(engineName)` | Validates the user name as one folder component using the rules above; rejects invalid names before deriving the destination. |
| `EnginePackageService._validatePackageFiles(archive)` | Checks the decoded file set and its path boundaries. Rejects invalid/conflicting paths without adding a manifest or starting an engine. |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` | Rejects deletion with the names of current profile/game references inside that exact folder. Active leases are checked by the platform owner instead. |

readAction, installAction and removeAction in the tables are local callbacks passed to _queuePackageWork, not additional public APIs. The runtime initialiseAction/startAction/stopSearchAction/disposalAction labels likewise name existing callback bodies, not new runtime methods. Existing underscore-prefixed runtime/client helpers retain their current owners and behaviour.

The service-worker additions are private platform helpers, not store/service APIs or a new implementation selector:

| Helper | Caller, result and ownership |
| --- | --- |
| `_ensurePackageServing(): Promise<void>` | BrowserProcessManager._prepareEntry shares registration/control readiness for stored browser files. Rejects failed readiness, clearing the settled work so Retry can start a fresh attempt. |
| `_waitForPackageControl(registration: ServiceWorkerRegistration): Promise<void>` | Readiness waits for activation and the matching document controller. Owns its bounded wait, listeners and disposal cancellation; removes them on every settlement. |
| `_acquirePackageLease(packagePath: string): () => void` | BrowserProcessManager._prepareEntry obtains the existing package-resource ownership shared with removal. Rejects acquisition during deletion; returns the release callback passed to the Worker owner. Does not inspect an engine or create a persisted record. |
| `_onPackageFetch(event: FetchEvent)` | App-owned service-worker event handler filters requests and synchronously supplies the response promise for stored-engine URLs. |
| `_resolveStoredFile(url: URL): { packagePath: string; relativePath: string }` | File serving decodes/validates the reserved URL into an exact package boundary and relative filename; rejects escaping or malformed paths. |
| `_servePackageFile(request: Request): Promise<Response>` | Fetch handling reads the original file bytes and returns the appropriate MIME/status response, without cached package copies. |
| `_readStoredFile(packagePath: string, relativePath: string): Promise<IEnginePackageFile>` | Shared files-store reader used by the package adapter and service-worker file handler. Opens the existing files store directly; the service worker does not construct Pinia stores or application services. |

### Existing option and runtime APIs

These signatures and their lifecycle behaviour stay unchanged. Their profile/assignment inputs use the revised launch fields, and runtime process-manager lookups gain clientType.

```ts
// EnginesStore
listConfiguredEngines(): IEngineRecord[];
getEngine(engineId: string): IEngineRecord | undefined;
validateAnalysisSelection(engineIds: string[]): void;
getOptionMeta(engineProfile: IEngineRecord | string): readonly IEngineOptionMeta[] | undefined;
loadOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>;
refreshOptionMeta(engineProfile: IEngineRecord | string): Promise<readonly IEngineOptionMeta[]>;

// EngineRuntimeService: relevant existing lifecycle operations.
ensureRuntime(engine: IAssignedEngine): IAssignedEngineRuntime;
getOptions(engineProfile: IEngineRecord): Promise<readonly IEngineOptionMeta[]>;
ensureReady(engine: IAssignedEngine, signal?: AbortSignal): Promise<void>;
startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest): Promise<void>;
stopAnalysis(engine: IAssignedEngine): Promise<void>;
startPlayerTurn(engine: IAssignedEngine, game: IGame, attemptPlayerMove: (move: IMove) => Promise<void>, signal?: AbortSignal): Promise<void>;
restartEngine(engine: IAssignedEngine): Promise<void>;
stopEngine(engine: IAssignedEngine): Promise<void>;
```

IEngineClient, the remaining runtime methods and game-turn policy retain their [existing contracts](LowLevel/Architecture/PlatformAbstraction/EngineClient.md). Package operations do not wrap or replace getOptions. No new cancellation parameter is added to spawnProcess or option discovery.

### Open API decisions

The first-use, naming, uniqueness, metadata and service-worker decisions are recorded in [Questions to answer before implementation](#questions-to-answer-before-implementation). The listed choices are settled. Package installation creates a unique named folder; there is no implicit replacement or separate version policy. The selected loading mechanism still requires implementation and real-engine verification after work is explicitly resumed.

File-action failures also need to retain their failing operation/stage through the existing error contract. A read/validation/transaction failure leaves no new files; a discovery failure after commit leaves the files installed and offers Refresh/Retry. The same distinction applies after a successful removal. Do not report every rejected store promise as a rolled-back file operation or add another persistence/error subsystem to hide that distinction.

## Function flows

Use the [stacked-table convention](LowLevel/ProcessFlows/index.md#conventions): each header is one caller, each row is a direct call in execution order, and follow-on tables expand delegated calls. Branches have separate tables. State writes, ownership and error behaviour sit outside the tables. Framework/storage primitives are terminal calls. Proposed owners/helpers below describe the design; existing runtime names describe the current implementation with the agreed launch/binding changes.

### Routed profile editing and file browsing

Route definitions and the complete view navigation remain in the [UI function flows](EngineManagementUiDesign.md#presentation-function-flows). SettingsView stays mounted, and RouterView mounts separate profile/import/details views. The route and Settings draft provide all editor inputs; no modal handle or hidden opener state is required.

| `SettingsView._openEngineEditor(profile)` |
| --- |
| `Router.push(profile ? editRoute(profile.id) : newProfileRoute)` |

| `EngineProfileView.load()` |
| --- |
| `SettingsStore.loadSettings()` |
| `EnginesStore.loadPackages()` |

New/edit/copy mode comes from the route. After settings load, copy the selected draft record and options into the local form, or show the missing-profile state. Then await package discovery separately; its failure offers Retry for file choices without hiding the editable form/current path. Read listPackages for the file selector, and getPackage only when resolving a packagePath hint. This also works for a direct profile URL without first visiting the overview. Stored package targets are chosen from the discovered files; selecting one changes the local entryPath only.

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
| `Router.replace(engineOverviewRoute)` |

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

| `EnginePackageDetailsView.load()` |
| --- |
| `EnginesStore.loadPackages()` |
| `EnginesStore.getPackage(packagePath)` |

For the overview, loadPackages is likewise an explicit route-entry action. Refresh explicitly calls refreshPackages. No watcher or polling is involved.

First load:

| `EnginesStore.loadPackages()` |
| --- |
| `EnginesStore.refreshPackages()` |

Already loaded or loading: return the current result or actual shared discovery promise; do not start another read.

| `EnginesStore.refreshPackages()` |
| --- |
| `EnginesStore._queuePackageWork(readAction)` |

| `readAction()` |
| --- |
| `EnginesStore._readPackages()` |

| `EnginesStore._readPackages()` |
| --- |
| `EnginePackageService.listPackages()` |

Replace the transient list only after successful discovery. Clear the actual in-flight read owner when it settles, permitting Retry after failure. getPackage finds a folder by packagePath; listPackages returns the current list.

| `EnginePackageService.listPackages()` |
| --- |
| `IPlatformService.getEnginePackageAdapter()` |
| `IEnginePackageAdapter.listPackagePaths()` |
| `EnginePackageService._readPackage(adapter, packagePath)` for each root |

| `EnginePackageService._readPackage(adapter, packagePath)` |
| --- |
| `IEnginePackageAdapter.listFiles(packagePath)` |

Construct IEnginePackage from the folder name, path, filenames and source namespace. An unreadable folder carries a warning; failure to enumerate storage is a discovery error. No file contents, name/version metadata or engine client are needed for discovery.

Browser adapter:

| `IEnginePackageAdapter.listPackagePaths()` |
| --- |
| `IndexedDB files-store key cursor` |

| `IEnginePackageAdapter.listFiles(packagePath)` |
| --- |
| `IndexedDB files-store key cursor restricted to packagePath` |

| `IEnginePackageAdapter.readFile(packagePath, relativePath)` |
| --- |
| `IndexedDB files-store get([packagePath, relativePath])` |

Distinct packagePath values in existing file keys are the imported folder list. Add the app-shipped bundled root and its build-declared filenames without installing it. Query keys only for discovery. The desktop adapter exposes the ordinary bundled root; external engine paths are used directly by profiles with no registration lookup. readFile is for actual resource access when needed, not metadata discovery.

| `EnginesStore.canInstallPackages()` |
| --- |
| `EnginePackageService.canInstall()` |

| `EnginePackageService.canInstall()` |
| --- |
| `IPlatformService.getEnginePackageAdapter()` |
| `IEnginePackageAdapter.canInstall()` |

### Reading and importing an archive

| `EnginePackageImportView._chooseArchive(file)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |
| `File.arrayBuffer()` |
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
| `EnginesStore.installPackage(engineName, archive, signal)` |

| `EnginesStore.installPackage(engineName, archive, signal)` |
| --- |
| `EnginesStore._queuePackageWork(installAction)` |

| `installAction()` |
| --- |
| `EnginePackageService.install(engineName, archive, signal)` |
| `EnginesStore._readPackages()` |

| `EnginePackageService.install(engineName, archive, signal)` |
| --- |
| `EnginePackageService._validateEngineName(engineName)` |
| `EnginePackageService._validatePackageFiles(archive)` |
| `IPlatformService.getEnginePackageAdapter()` |
| `IEnginePackageAdapter.canInstall()` |
| `IEnginePackageAdapter.installFiles(packagePath, archive.files, signal)` |

The service derives the managed root from the validated engineName. The adapter checks that no installed engine has that name at publication, including the included engine name. The store retains the returned packagePath, refreshes discovery, then returns that same path to the view for Create profile. No vendor name/version or ZIP filename determines the destination.

Browser publication:

| `IEnginePackageAdapter.installFiles(packagePath, files, signal)` |
| --- |
| `IndexedDB readwrite transaction: reject an existing engine name before writes` |
| `ObjectStore.put(file, [packagePath, relativePath])` for each supplied file |
| `transaction completion/abort/error events` |

Check cancellation before issuing the transaction. Once issued, the returned promise stays owned until the actual transaction commits or aborts. A cancellable transaction may abort, but rejecting a UI promise alone does not settle publication. Atomic commit publishes all original files; failure/abort publishes none. Discovery runs afterwards, with no catalogue or manifest publication. A discovery failure after commit reports that the files were saved and the list needs Retry; it does not claim installation rolled back.

Shared sequencing helper:

| `EnginesStore._queuePackageWork(action)` |
| --- |
| `await previous package work settlement` |
| `action()` |

Keep the actual action promise for its caller, with a settled queue tail for the next action. Each owner observes its own failure. Reads and mutations use this same queue; helpers already executing inside it call _readPackages directly rather than recursively queueing and deadlocking. This is in-memory operation ownership, not a new persisted queue.

### Leaving import and using included app files

| `EnginePackageImportView.onBeforeRouteLeave(to, from)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |

| `EnginePackageImportView.onBeforeRouteUpdate(to, from)` |
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
| `existing simple confirmation modal` |
| `EnginesStore.removePackage(packagePath, readReferences)` after confirmation |

The view's readReferences callback reads SettingsStore.settings, SettingsStore.draftSettings and GamesStore.listGames(), projecting profiles and player/analysis assignments to IEnginePackageUsage. Include accepted profiles even when deleted only in the draft. The source data is read again when deletion reaches the queue, rather than using Details' displayed snapshot.

| `EnginesStore.removePackage(packagePath, readReferences)` |
| --- |
| `EnginesStore._queuePackageWork(removeAction)` |

| `removeAction()` |
| --- |
| `readReferences()` |
| `EnginePackageService.remove(packagePath, references)` |
| `EnginesStore._readPackages()` |

| `EnginePackageService.remove(packagePath, references)` |
| --- |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` |
| `IPlatformService.getEnginePackageAdapter()` |
| `IEnginePackageAdapter.removeFiles(packagePath)` |

_assertPackageUnreferenced checks compatible virtual entry paths by exact package boundary, not string-prefix coincidence; native executable targets are not managed package references. Pass named references back to the view when blocked. Do not delete/retarget profiles or assignments.

| `IEnginePackageAdapter.removeFiles(packagePath)` |
| --- |
| `platform package owner: claim deletion unless resources are leased` |
| `IndexedDB readwrite transaction deleting file keys under packagePath` |
| `transaction completion/abort/error events` |

Do not defer the lease/deletion ownership decision until after asynchronous deletion starts. Release deletion ownership on settlement. Only managed package files are removed; the desktop adapter never deletes a user's executable or package folder.

### Existing option discovery

Cache-hit branch:

| `EnginesStore.loadOptionMeta(engineProfile)` |
| --- |
| `EnginesStore.getOptionMeta(engineProfile)` |

Cache-miss branch:

| `EnginesStore.loadOptionMeta(engineProfile)` |
| --- |
| `EnginesStore.getOptionMeta(engineProfile)` |
| `EnginesStore.refreshOptionMeta(engineProfile)` |

| `EnginesStore.getOptionMeta(engineProfile)` |
| --- |
| `EnginesStore._resolveEngine(engineProfile)` |
| `Map.get(engineId)` |
| `EnginesStore._isCacheEntryCurrent(entry, engine)` when both exist |

Return current metadata, or discard a stale cache entry. For an explicit object, _resolveEngine returns that object directly. For an id:

| `EnginesStore._resolveEngine(engineId)` |
| --- |
| `EnginesStore.getEngine(engineId)` |

| `EnginesStore.getEngine(engineId)` |
| --- |
| `EnginesStore.listConfiguredEngines()` |

| `EnginesStore.listConfiguredEngines()` |
| --- |
| `EnginesStore._getInventory()` |

| `EnginesStore._getInventory()` |
| --- |
| `UserSettingService.getSettings()` |

Read the accepted analysis.engineInventory. No file-discovery API is inserted.

| `EnginesStore.refreshOptionMeta(engineProfile)` |
| --- |
| `EnginesStore._resolveEngine(engineProfile)` |
| `EnginesStore._createCacheEntry(engine, [])` |
| `EngineRuntimeService.getOptions(engine)` |
| `EnginesStore._resolveEngine(engineProfile)` |
| `EnginesStore._isCacheEntryCurrent(pendingEntry, currentEngine)` |
| `Map.set(engineId, metadataEntry)` only when current |

Compare clientType/entryPath instead of clientType/executablePath/protocol. Keep the existing profile-id cache and successful-result check; no file fingerprints, installation state or new cancellation API.

| `EngineRuntimeService.getOptions(engineProfile)` |
| --- |
| `EngineRuntimeService._createAssignedEngine(engineProfile)` |
| `EngineRuntimeService.ensureReady(temporaryEngine)` |
| `EngineRuntimeService._getEngineClient(temporaryEngine)` |
| `IEngineClient.getOptions(temporaryEngine)` |
| `EngineRuntimeService._copyOptionMeta(option)` for each result |
| `EngineRuntimeService.stopEngine(temporaryEngine)` in finally |

_createAssignedEngine copies name/clientType/entryPath and a fresh options map. The temporary assignment is not added to a game or store. Its runtime closes before getOptions resolves, including handshake failure. Option discovery remains normal engine initialisation with configured options, rather than package inspection.

### Assignment and mixed runtime startup

Player and analysis selectors continue to read accepted profiles and copy the launch data/options through their existing handlers. No package install/resolve/check step is inserted into assignment. Profile changes do not affect existing copies.

Existing game-creation preflight:

| `GameCreationModal._validateRequiredEngines(request)` |
| --- |
| `EngineRuntimeService.getOptions({ ...assignedEngine, id: player.colour })` for each required engine player |

Retain its current both-seats-assigned condition, cancellation and error presentation. Do not redirect it through the metadata cache or extend it to settings/profile assignment.

Analysis startup:

| `GameAnalysisComposable._startAnalysisSeat(game, seat)` |
| --- |
| `EngineRuntimeService.ensureRuntime(seat.engine)` |
| `shallowReactive(runtime)` |
| `GameAnalysisComposable._subscribeToAnalysis(game, seat)` |
| `EngineRuntimeService.startAnalysis(seat.engine, game, request)` |

Keep the existing subscription, timestamp and current-seat error/finally handling. _subscribeToAnalysis disposes the previous subscription and calls EngineRuntimeService.subscribeToAnalysis. The shared runtime flows below apply independently to each assigned engine.

Player startup:

| `GamePlayerTurnComposable._requestEngineMove(engine)` |
| --- |
| `EngineRuntimeService.ensureReady(engine, abortController.signal)` |
| `EngineRuntimeService.startPlayerTurn(engine, game, guardedMoveCallback, abortController.signal)` |

This existing private helper belongs to the turn action. Game-level deferred moves, cancellation, legality and pondering retain their [current ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md#player-turn-runtime).

| `EngineRuntimeService.ensureReady(engine, signal)` |
| --- |
| `EngineRuntimeService._createBaseRuntime(engine)` |
| `EngineRuntimeService._runEngineOperation(runtime, Ready, initialiseAction, signal)` |

Already aborted: return before creating work. _createBaseRuntime preserves an existing runtime or creates assignment.$. _runEngineOperation awaits its action, publishes success/failure only while its caller remains active, and retains the existing InvalidProcessHandle handling.

| `EngineRuntimeService._runEngineOperation(runtime, successAvailability, action, signal)` |
| --- |
| `action()` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, successAvailability)` unless aborted |

On failure, clear a handle only for InvalidProcessHandle and publish Failed unless aborted, then rethrow. ensureReady consumes that rejection only when its supplied signal has been aborted.

| `initialiseAction()` |
| --- |
| `EngineRuntimeService._initialiseEngine(engine, runtime, signal)` |

New process branch:

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal)` |
| --- |
| `IPlatformService.getProcessManager(engine.clientType)` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Starting)` |
| `IProcessManager.spawnProcess(engine.entryPath)` |
| `EngineRuntimeService._runAnalysisClientWork(runtime, initialiseClientAction)` unless aborted |

Existing handle branch:

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal)` |
| --- |
| `IPlatformService.getProcessManager(engine.clientType)` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Starting)` |
| `IProcessManager.assertProcessHandleOpen(runtime.processHandle)` |
| `EngineRuntimeService._runAnalysisClientWork(runtime, initialiseClientAction)` unless aborted |

InvalidProcessHandle branch, following the failed handle check:

| `EngineRuntimeService._initialiseEngine(engine, runtime, signal)` |
| --- |
| `IProcessManager.spawnProcess(engine.entryPath)` |
| `EngineRuntimeService._runAnalysisClientWork(runtime, initialiseClientAction)` unless aborted |

Use the manager already selected for this assignment. Other errors propagate. Capture a late spawn's returned handle even when cancellation occurred, so pending disposal can release it; spawnProcess gains no AbortSignal argument.

| `initialiseClientAction()` |
| --- |
| `EngineRuntimeService._getEngineClient(engine)` |
| `IEngineClient.initialiseEngine(engine)` |

| `EngineRuntimeService._getEngineClient(engine)` |
| --- |
| `IPlatformService.getEngineClient(engine.clientType)` |

| `IPlatformService.getEngineClient(clientType)` |
| --- |
| `shared binding table lookup by clientType` |

| `IPlatformService.getProcessManager(clientType)` |
| --- |
| `same binding table lookup by clientType` |

The lookup returns the respective member of one registered pair. Apply the manager argument to _assertProcessHandleOpen, isRuntimeAlive and _releaseEngineProcess as well as startup; otherwise mixed native/Worker sessions would use the wrong owner during checks or cleanup. Never infer this choice from a handle or the package source.

| `EngineRuntimeService._assertProcessHandleOpen(engine, runtime)` |
| --- |
| `IPlatformService.getProcessManager(engine.clientType)` |
| `IProcessManager.assertProcessHandleOpen(runtime.processHandle)` |

A missing handle raises the existing engine-not-initialised error before reaching the manager.

| `EngineRuntimeService.isRuntimeAlive(engine)` |
| --- |
| `EngineRuntimeService._getRuntimeState(engine)` |
| `IPlatformService.getProcessManager(engine.clientType)` |
| `IProcessManager.assertProcessHandleOpen(runtime.processHandle)` |

Return false before the manager call when runtime/handle is absent or status is Unavailable/Failed. InvalidProcessHandle also returns false; other errors propagate, with no runtime mutation.

### Process creation and client initialisation

Native Uci branch:

| `IProcessManager.spawnProcess(entryPath, args)` |
| --- |
| `existing NwjsProcessManager executable launch and process registration` |

The native implementation keeps its current process/transport semantics. No executable copying or package registration is added.

UciWorker branch, using the existing BrowserProcessManager with private entry preparation:

| `BrowserProcessManager.spawnProcess(entryPath, args)` |
| --- |
| `BrowserProcessManager._prepareEntry(entryPath)` |
| `createWorker(prepared.url)` |
| `new BrowserUciTransport(worker, onClosed)` |
| `registry.set(handle, transport)` |

Reject unsupported arguments before preparation. BrowserProcessManager._prepareEntry returns the real URL/resource release callback; the chosen entry keeps its upstream name/layout. Record ownership immediately. Failed Worker/transport construction terminates any created Worker and releases prepared resources before returning the existing process-start error. A successful spawn transfers that release callback to onClosed. Remove the old Stockfish alias/path special case.

App-shipped or desktop file branch:

| `BrowserProcessManager._prepareEntry(entryPath)` |
| --- |
| `new URL(resolvedEntryPath, appBaseUrl)` |

Desktop resolves external paths using its existing filesystem capabilities. Bundled entries keep their app URL. This branch needs no browser package-service registration or stored-file lease; return the resolved URL and the corresponding resource release callback.

Browser-stored user package branch:

| `BrowserProcessManager._prepareEntry(entryPath)` |
| --- |
| `_ensurePackageServing()` |
| `_acquirePackageLease(packagePath)` |
| `new URL(encodedPackageFilePath, appBaseUrl)` |

Resolve the virtual entry into its exact user package root and relative path. Encode each path component into the reserved engine-files URL, retaining the directory hierarchy. Return that URL and the acquired lease's release callback. Release an acquired lease if later preparation fails. The lease lasts until Worker closure, covering later relative asset requests as well as initial script/WASM loading. Missing files remain normal launch errors, not installation/profile-save probes.

Initial registration or retry branch:

| `_ensurePackageServing()` |
| --- |
| `navigator.serviceWorker.register(appServiceWorkerUrl, { scope: appBaseUrl })` |
| `_waitForPackageControl(registration)` |

Share the actual pending readiness promise; do not duplicate registration waits. If the matching active registration already controls the document, return without another wait. Unsupported/failed registration rejects through existing process-start handling. A failed attempt clears its operation owner so another engine retry can try again.

| `_waitForPackageControl(registration)` |
| --- |
| `navigator.serviceWorker.addEventListener('controllerchange', onControlChanged)` |
| `installingWorker.addEventListener('statechange', onStateChanged)` when activation is pending |
| `setTimeout(onReadinessTimeout, readinessTimeoutMs)` |

Install listeners before checking current state to close the observation gap. Resolve only when the active worker for this registration controls the current app document; a different registration's controller is insufficient. Reject activation failure, timeout or platform-owner disposal. Remove listeners and clear the timer on every outcome. This is one bounded, event-owned wait, without polling or generation counters. spawnProcess retains its existing public signature and captures any late successful handle for normal disposal.

App-owned service-worker activation:

| `_onPackageActivate(event)` |
| --- |
| `self.clients.claim()` |
| `event.waitUntil(claimPromise)` |

Claim clients within the registration's app scope so the first stored-engine launch does not require a manual page reload. Let the browser retain the shared registration across engine stops; individual package disposal does not unregister it.

Serving the engine entry and its relative assets:

| `_onPackageFetch(event)` |
| --- |
| `new URL(event.request.url)` |
| `_servePackageFile(event.request)` for the reserved same-origin engine-files path |
| `event.respondWith(responsePromise)` synchronously for that path |

Requests outside the reserved prefix use the ordinary network/app path, including the directly loaded bundled engine. The app page must be controlled before the dedicated Worker is created so its entry request can reach this handler. No app-shell caching or catch-all route response belongs here.

| `_servePackageFile(request)` |
| --- |
| `new URL(request.url)` |
| `_resolveStoredFile(url)` |
| `_readStoredFile(packagePath, relativePath)` |
| `new Response(file.data, responseOptions)` |

| `_readStoredFile(packagePath, relativePath)` |
| --- |
| `IndexedDB readonly files-store get([packagePath, relativePath])` |

Decode URL components once and reject invalid names, encoded separators or paths escaping the selected package. The URL maps to actual files, not an installation id or generated manifest. GET responses supply original bytes with a MIME type derived from the filename, including text/javascript for scripts and application/wasm for WASM, and no-store caching. The handler reads the existing files store directly through its shared reader; it does not initialise application stores or engine clients.

Malformed paths, absent files, unsupported methods and storage failures produce explicit HTTP errors. Never substitute the app HTML page, another engine or a network-fetched replacement. The existing Worker/transport/client error flow reports loading failures and releases the package lease through onClosed. A missing sibling resource therefore fails that engine's normal startup rather than leaving a partially initialised session silently running.

The build emits the service-worker handler as an app-owned asset at its stable app-relative URL for both development and production. Its filename is unrelated to vendor entry filenames. File storage schema and package names remain the current unreleased format; this adds no migration helper or persisted loading descriptor.

| `defineUciEngineClientStore(storeId, clientType, resolveTransport)` |
| --- |
| `defineStore(storeId, setup)` |

This is the proposed composition signature change: add the registered clientType to the existing factory and use it in the hard-coded assignment guard. Its native/Worker instances receive the matching registry transport resolver. This shares UCI session code without adding a separate protocol discriminator.

Fresh client-session branch:

| `IEngineClient.initialiseEngine(engine)` |
| --- |
| `UciEngineClient._requireProcessHandle(engine)` |
| `UciEngineClient._requireTransport(processHandle)` |
| `UciEngineClient._initialiseAssignedEngineSession(engine)` |
| `UciEngineClient._attachTransport(engine, processHandle, session)` |
| `UciEngineClient._awaitUciOk(session, processHandle)` |
| `parseOptionLines(lines)` |
| `buildSetOptionCommand(name, value)` for each configured option |
| `UciEngineClient._writeCommand(processHandle, command)` for each option |
| `UciEngineClient._awaitReadyOk(session, processHandle)` |

| `UciEngineClient._attachTransport(engine, processHandle, session)` |
| --- |
| `UciEngineClient._requireRuntimeAssignedEngine(engine)` |
| `UciEngineClient._requireTransport(processHandle)` |
| `IUciTransport.subscribe(onLine, onExit)` |

| `UciEngineClient._awaitUciOk(session, processHandle)` |
| --- |
| `buildUciCommand()` |
| `UciEngineClient._writeCommand(processHandle, command)` |
| `await the current AwaitingUciOk completion` |

| `UciEngineClient._awaitReadyOk(session, processHandle)` |
| --- |
| `UciEngineClient._assertSessionOperational(session)` |
| `buildIsReadyCommand()` |
| `UciEngineClient._writeCommand(processHandle, command)` |
| `await the current AwaitingReadyOk completion` |

| `UciEngineClient._writeCommand(processHandle, command)` |
| --- |
| `UciEngineClient._requireTransport(processHandle)` |
| `IUciTransport.write(command)` |

Native writes use its existing transport. Worker writes use Worker.postMessage(command); string message events feed the same client parser. Existing already-initialised, failed/stopped replacement, line parsing and handshake rejection branches remain in the client. Package discovery/import does not enter this flow.

### Analysis operation ownership and stop acknowledgement

| `EngineRuntimeService.startAnalysis(engine, game, request)` |
| --- |
| `EngineRuntimeService._assertBaseRuntime(engine)` |
| `EngineRuntimeService._beginAnalysisOperation(runtime)` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Starting)` |
| `EngineRuntimeService._queueAnalysisOperation(runtime, operation, startAction)` |

| `startAction(signal)` |
| --- |
| `EngineRuntimeService.ensureReady(engine, signal)` |
| `signal.throwIfAborted()` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Starting)` |
| `EngineRuntimeService._runAnalysisClientWork(runtime, startClientAction)` |
| `signal.throwIfAborted()` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Running)` unless already final |

Set analysisNeedsStop before issuing the client action.

| `startClientAction()` |
| --- |
| `EngineRuntimeService._getEngineClient(engine)` |
| `IEngineClient.startAnalysis(engine, game, request, guardedCallback)` |

The guard retains operation/subscriber identity and legal-output checks; package support does not change those rules.

| `EngineRuntimeService._queueAnalysisOperation(runtime, operation, action)` |
| --- |
| `await runtime's previously issued analysis work` |
| `operation.abortController.signal.throwIfAborted()` |
| `action(signal)` |
| `signal.throwIfAborted()` |
| `operation.completion.resolve()` |

_beginAnalysisOperation aborts/rejects the previous operation and creates the actual controller/completion owner. Failures go through the existing _failAnalysisOperation. No generation counter is introduced.

| `EngineRuntimeService._runAnalysisClientWork(runtime, action)` |
| --- |
| `action()` |
| `client-work completion.resolve()` in finally |

Register the actual client-work completion on runtime before invoking action and clear it in finally. Disposal relies on that owned completion to interrupt blocked client waits and drain them.

Search issued branch:

| `EngineRuntimeService.stopAnalysis(engine)` |
| --- |
| `EngineRuntimeService._getRuntimeState(engine)` |
| `EngineRuntimeService._beginAnalysisOperation(runtime)` |
| `EngineRuntimeService._queueAnalysisOperation(runtime, operation, stopSearchAction)` |

| `stopSearchAction(signal)` |
| --- |
| `EngineRuntimeService._assertProcessHandleOpen(engine, runtime)` |
| `EngineRuntimeService._runAnalysisClientWork(runtime, stopClientAction)` |
| `signal.throwIfAborted()` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Ready)` |

| `stopClientAction()` |
| --- |
| `EngineRuntimeService._getEngineClient(engine)` |
| `IEngineClient.stopAnalysis(engine)` |

Keep the existing StoppingSearch -> terminating bestmove -> Ready acknowledgement, then clear analysisNeedsStop. Retain displayed results. A stop completion is not a player-move result.

No issued search branch: use the same operation queue, skip the client stop, clear analysisNeedsStop and publish Ready/Unavailable according to the current handle. No runtime branch: return without creating work. These are the existing stop conditions, not new availability gates.

### Disposal, restart and resource release

| `EngineRuntimeService.stopEngine(engine)` |
| --- |
| `EngineRuntimeService._getRuntimeState(engine)` |
| `EngineRuntimeService._queueEngineDisposal(engine, runtime, false)` when runtime exists |

| `EngineRuntimeService.restartEngine(engine)` |
| --- |
| `EngineRuntimeService._createBaseRuntime(engine)` |
| `EngineRuntimeService._queueEngineDisposal(engine, runtime, true)` |

| `EngineRuntimeService._queueEngineDisposal(engine, runtime, restart)` |
| --- |
| `EngineRuntimeService._beginAnalysisOperation(runtime)` |
| `schedule the existing interruptionAction()` |
| `Promise.all([previousWork, clientWork, interruption])` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Starting)` for restart |
| `EngineRuntimeService._queueAnalysisOperation(runtime, operation, disposalAction)` |

Capture previousWork, clientWork and the existing subscriber before replacing the analysis-work tail. Interruption runs alongside that work; disposalAction waits for the combined settlement through the existing queue. It must not simply wait on a blocked handshake without interrupting its process.

Active, issued client-work branch:

| `interruptionAction()` |
| --- |
| `EngineRuntimeService._stopEngineProcess(engine, runtime)` |

Skip an unissued interruption after supersession or when there is no captured client work. Existing interruption failures go through _failAnalysisOperation.

Stop branch:

| `disposalAction(signal)` |
| --- |
| `EngineRuntimeService._stopEngineProcess(engine, runtime)` |
| `signal.throwIfAborted()` |
| `EngineRuntimeService._setRuntimeAvailability(runtime, Unavailable)` |

Clear only the captured analysis callback if it remains the current subscriber.

Restart branch:

| `disposalAction(signal)` |
| --- |
| `EngineRuntimeService._restartEngineProcess(engine, runtime, signal)` |

| `EngineRuntimeService._restartEngineProcess(engine, runtime, signal)` |
| --- |
| `EngineRuntimeService._stopEngineProcess(engine, runtime)` |
| `signal.throwIfAborted()` |
| `EngineRuntimeService.ensureReady(engine, signal)` |

| `EngineRuntimeService._stopEngineProcess(engine, runtime)` |
| --- |
| `EngineRuntimeService._releaseEngineProcess(engine, runtime)` |

Share an already issued analysisShutdownWork promise instead of releasing the same handle twice. Store the actual release work until its finally settles.

Handle exists branch:

| `EngineRuntimeService._releaseEngineProcess(engine, runtime)` |
| --- |
| `IPlatformService.getProcessManager(engine.clientType)` |
| `IProcessManager.stopProcess(runtime.processHandle)` |
| `EngineRuntimeService._stopClientSession(engine)` |
| `EngineRuntimeService._clearAnalysisState(runtime)` |

Ignore only InvalidProcessHandle, then stop the client session. Clear processHandle before clearing analysis state. With no handle, skip physical/client shutdown and only clear shared state. Preserve the existing order: physical shutdown first releases blocked waits, then client/session cleanup. A cleanup failure is not silently treated as success.

| `EngineRuntimeService._stopClientSession(engine)` |
| --- |
| `EngineRuntimeService._getEngineClient(engine)` |
| `IEngineClient.stopEngine(engine)` |

Worker physical shutdown:

| `BrowserProcessManager.stopProcess(handle)` |
| --- |
| `BrowserProcessManager._requireTransport(handle)` |
| `BrowserUciTransport.terminate()` |

| `BrowserUciTransport.terminate(detail)` |
| --- |
| `Worker.removeEventListener(...)` for message/error/messageerror |
| `Worker.terminate()` |
| `onClosed()` |
| `registered exit listeners(detail)` |

| `onClosed()` |
| --- |
| `registry.delete(handle)` |
| `prepared.release()` |

terminate marks the transport closed before callbacks, retains exit detail, then clears listener sets after exit notification. Repeated termination is a no-op. Existing Worker error/messageerror handlers enter this same termination path. Failed startup, normal stop, crash and restart therefore release the actual prepared resources, while other assignments keep their own handles/leases. Stored-engine URLs use the selected service worker; onClosed releases the package lease without unregistering that shared handler. Runtime verification remains outstanding.

## Current contract changes and delivery

Remove engine `protocol`, `EngineProtocol`, `engineProtocols` and `engineProtocolSchema` from contracts/schemas, copies/defaults, option-cache keys, imports/fixtures and the read-only Protocol row as the current EngineProfileModal form moves into the page editor. Retain unrelated `URL.protocol` checks. Update affected runtime/store/composable/modal/journey utilities and architecture examples during implementation.

Keep settings, saved-game and unrelated session/layout documents at their initial schema version. The app is unreleased; change the current readers, writers, defaults and fixtures together. There are no migration helpers, version branches, alias mappings or compatibility representations. No package-manifest schema exists.

Profiles and assignments store the exact entry path, client type, label and options. Exports omit engine binaries and runtime state. Parsing a saved game does not start an engine or import package files. Missing files or a foreign-host path remain current-format availability errors with explicit relink.

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 0. UI review | Actual entry-file selection, desktop direct paths, browser-only import | Validated unique engine name/folder, no version field, no assumed entry filenames/manifests or desktop installation. |
| 1. Runtime proof | Real Stockfish plus an independent worker using upstream layouts | Direct bundled files and service-worker-served imports load their actual scripts/relative assets; initial control, reload, normal runtime operations and cleanup pass. |
| 2. Current contracts | Entry path, single client enum, source enum, protocol removal | Exact paths/options round-trip without installation ids or new package metadata. |
| 3. Package files | Desktop reads; browser discovery/import/removal | No package writes on desktop, browser list reconstructs from files, duplicate name is rejected and cancelled/failed import publishes nothing. |
| 4. Composition/defaults | Matching client/resource owners, ordinary bundled files/profile | Native/browser runtimes coexist with isolated stop/crash/restart; default uses same loader. |
| 5. Acceptance | Forms, focused tests, browser/NW.js journeys and architecture docs | Exact entry selection, Apply/Cancel, recovery and reference checks; separate simulation from real runtime results. |

Cover unique/invalid engine names, folder-name display, ambiguous multi-build archives, Node-only metadata entries, helper-worker confusion, different layouts/names, absent scripts/assets, path traversal, external changes, missing/foreign-host paths, cancellation/disposal and ignored protocol removal. Run `npm run check:code`, focused Vitest suites, affected Playwright journeys and `npm run build` after implementation. Real NW.js mixed-engine acceptance remains required. This is a plan and simulated design, not implemented engine loading.
