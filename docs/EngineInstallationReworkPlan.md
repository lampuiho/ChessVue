# Engine targets, browser packages and profiles

Prepared on 23 October 2026; revised on 24 October 2026. Status: proposed design for review; implementation is stopped. See the [UI specification](EngineManagementUiDesign.md) and [clickable preview](design/EngineManagement.html).

First review the [shared-process contract and verified Worker adaptation](NwjsProcessOwnershipFixPlan.md#shared-process-feasibility-verified), and rebase the [browser engine dependency correction](BrowserEngineDependencyFixPlan.md) on it. The selected contract retains the native process or Worker adapter directly on the runtime, replacing handle lookups. The native correction removes both native process maps and moves line I/O into the existing NwjsUtility. Review the browser alignment before implementing the shared boundary. Package rework follows the verified corrections and still requires an explicit instruction to resume implementation.

NW.js has first been restored to its standalone process-based UCI implementation. Preserve that restoration: the browser correction and package rework do not authorise routing the native client through the browser UCI factory again.

The NW.js plan supersedes this draft's processHandle/assertProcessHandleOpen references. Rebase those references to process/assertProcessOpen when the prerequisite is implemented; the package rework must not restore the old runtime field or native registry. This changes no package, profile or UI decision below and adds no EngineRuntimeService public API.

The app has never been released. Update the current schemas and fixtures directly, keeping the initial schema version. Do not add migrations, compatibility readers, old-field conversions or runtime aliases.

The [detailed API](#detailed-api) and [function flows](#function-flows) below describe the additions and changes required by this rework. Existing EngineRuntimeService APIs and lifecycle remain defined by the [runtime ownership flow](LowLevel/ProcessFlows/EngineRuntimeOwnership.md); they are not being redesigned here. Keep the rework details in this plan while the design is under review.

## Questions to answer before implementation

Decisions confirmed by the user on 24 October 2026:

1. **Included engine:** load directly from app-shipped package files. Do not copy it into browser package storage. It appears as an ordinary available package/default profile and uses the matching engine client.
2. **Import destination:** the installed engine name is its folder name. The import view has an Engine name input with folder-name character validation. The name is separate from any profile name and the vendor's archive filename.
3. **Uniqueness:** installed engine names must be unique. The frontend checks its loaded engine list and blocks a duplicate name. These answers do not authorise a separate in-place replacement workflow.
4. **Versions:** no separate version field or upstream name/version discovery. Display the folder name as the engine name. Users may include a version in that name themselves.
5. **Stored-script loading:** use a service worker to serve browser-stored package files at ordinary same-origin URLs, preserving their relative layout.

The listed questions have been answered. The [selected loading design](#stored-script-loading-options) and its function flows remain a plan for review; real-engine verification is outstanding. Implementation is stopped pending an explicit instruction to resume.

## Installed engine names

Use the Engine name as one folder component, preserving the entered name in storage and display. The frontend import view owns both name-format and uniqueness validation, using its already loaded engine list, and enables Install only for a valid, unique name. EnginesStore and EnginePackageService receive the validated name without repeating either check. The list includes the built-in folder, whose name is also unavailable. Profile labels remain independently editable.

Reject an empty/whitespace-only name, . or .., path separators, control characters, the characters `< > : " / \ | ? *`, and a trailing space or dot. Also reject reserved device names such as CON/NUL/COM1/LPT1, including their extension forms. Unicode names, spaces within names, hyphens and version text remain usable. Compare engine names without case differences so Stockfish and stockfish do not become duplicate-looking entries. These validation rules follow [Windows folder-name constraints](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) while keeping the user-supplied name.

## Stored-script loading options

Selected by the user on 24 October 2026: **service-worker package URLs**. An app-owned file-serving service worker maps a reserved path under the app base, for example /engine-files/Example/engine.js, to the exact stored package file. Requests for neighbouring scripts/WASM/NNUE resolve within that same URL hierarchy, with original filenames and bytes. This is the selected architecture, not completed runtime proof.

The handler responds only to the reserved stored-engine path. Ordinary app requests, including bundled engine files, keep their normal network/app-file path. Package discovery/import and profile editing do not register the service worker or start an engine; registration/control readiness belongs to resource preparation when a stored engine is actually launched. A service worker can synthesise these file responses and leave other requests alone; see [fetch events](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).

The build must serve the app-owned service-worker script at a stable URL beneath the app base in development and production. Its registration scope covers the app page that creates engine Workers, while its fetch handler filters to engine-file URLs. Await the matching active registration and actual page control before creating a stored engine Worker. Registration requires a secure context; activation can [claim clients](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim), and [controllerchange](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controllerchange_event) confirms control. A bare [ready promise](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/ready) is not a bounded failure-handling strategy.

Use one shared, owned readiness operation with listener/timer cleanup, a bounded wait and retry after failure. Unsupported registration, failed activation or failure to obtain control becomes the existing process-start error; do not launch through an unready virtual URL or introduce a Blob/server fallback. Host disposal settles pending readiness work. Stopping an individual engine releases its package lease and Worker, not the shared service-worker registration. No app-shell cache, offline policy, installation catalogue or additional public engine API is introduced.

Keep the generic engine/package APIs and single EngineClientType selector. Real Stockfish plus an independent engine, relative assets, initial control without manual reload, reload, failed registration/read and cleanup remain required verification. Application implementation remains stopped.

## Scope

Enable browser profiles to select and load other engines using their supplied entry files. Reuse the existing initialisation, getOptions, analysis/player operations and cleanup. Package import stores files; it does not launch engines or classify their capabilities. Runtime lifecycle policy is unchanged.

### Implementation boundary

**Implementation must change only what this plan explicitly specifies as a change. All unmentioned APIs, behaviour, data contracts, persistence and architecture must remain unchanged.** A call shown for context does not authorise changing its API or implementation. Do not refactor surrounding code or add unrelated work. If implementation requires an additional API, behaviour or architecture change, raise it with the user and wait for their decision before adding it to the plan or code.

EngineRuntimeService retains every existing public method, name, signature, parameter, return contract and error/cancellation/lifecycle behaviour. No new runtime API, package operation or preparation step is added to its public surface. Its only implementation edits are the existing launch-data and platform-binding substitutions required by this plan:

- _createAssignedEngine copies entryPath instead of executablePath and stops copying the removed protocol field.
- _initialiseEngine passes engine.clientType to the existing process-manager lookup and engine.entryPath to spawnProcess, including its existing invalid-handle retry.
- _assertProcessHandleOpen, isRuntimeAlive and _releaseEngineProcess pass engine.clientType to their process-manager lookups.

Keep their existing branching, sequencing, ownership, cancellation, error handling and cleanup intact. The client lookup already uses clientType and needs no API change. Option discovery, analysis, player turns, stop and restart continue through their existing callers and lifecycle. Implementation remains stopped pending an explicit instruction to resume.

## Agreed model

Desktop profiles point directly to an executable or the entry file inside a browser engine package, wherever the user keeps it. Browse uses the ordinary file dialog: navigate into the unpacked folder and choose the actual executable/script. There is no desktop installation, registration or engine catalogue.

- Browser import stores the supplied package files, preserving their relative layout. Discover imported packages by reading those folders, without separate installation records.
- Require neither a fixed entry filename nor a new manifest. Upstream archives do not generally contain a ChessVue manifest. Do not generate one during browser import or modify desktop folders.
- The engine name comes from its folder, not upstream package metadata. Ask for the entry/interface explicitly; never guess the first JavaScript file or assume an npm `main` is a Worker.
- Proposed engine APIs and data contracts stay generic across hosts: loadPackages, refreshPackages, listPackages, getPackage, browseEngineFile and IEnginePackage. browseEngineFile(startDirectory?) chooses an executable or entry-script file and returns its path, delegating to the existing IStorageAdapter.showOpenDialog contract. Capability checks expose available operations. EnginePackageService owns browser package storage directly; existing platform implementations handle file pickers and process/Worker loading. No desktop/browser API families or host-discriminated DTOs.
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
| `EnginePackageService` | Own browser package discovery, file reads, import and removal directly through IndexedDB. Add bundled filenames from the app build asset definition; no desktop package implementation or new platform interface. |
| `EnginesStore.loadPackages()` / `refreshPackages()` | Own/share discovery through the same API when the package list is opened and after explicit import/removal/Refresh actions. Desktop paths have no managed inventory to enumerate. Preserve profile drafts; no host checks, watchers or polling. |
| Profile/import target action | The existing file dialog returns a chosen file path; the profile form copies it into entryPath. Stored package files are selected directly from IEnginePackage.files. Archive input uses IEnginePackageFile (filename and original bytes), not File/Blob or a native picker handle. Validate archive paths/files through layer-2 services and own file-operation cancellation. |
| Assignment | Copy the selected profile through the existing game/player/analysis handlers. No new resolution API or preflight. |
| Asset preparation | BrowserProcessManager resolves the exact entry URL and owns the Worker lease; the service-worker entry point reads stored files through EnginePackageService. Derive the package boundary from its virtual path, not a registry id. |

```text
Desktop profile -> executable entry -> native client/process
Desktop profile -> supplied JS entry -> matching browser client
Browser profile -> stored virtual entry -> same browser client
```

## Browser import and defaults

Only browser hosts need import/removal. EnginesStore coordinates file storage through EnginePackageService, which reads and writes IndexedDB directly. EngineRuntimeService retains its existing operations for engines in use and temporary option discovery.

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

Use the private base/subclass design from the [dependency correction](BrowserEngineDependencyFixPlan.md#private-inheritance-design): UCI operations stay in the base, and the browser subclass overrides protected transport lookup. For this later package rework, parameterise the hard-coded Uci guard with the registered client enum value. The restored native UCI client keeps its own factory and direct process communication. Other interfaces can implement `IEngineClient` directly. Preserve turns, pondering, analysis stop acknowledgement, supersession, pause/deferred-result and legality semantics. Each assignment owns its runtime; share package bytes, not sessions. Verify actual [NW.js worker configuration](https://docs.nwjs.io/References/Command%20Line%20Options/) and packaging.

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
| `canInstallPackages()` | Settings/import views ask whether managed package writes are available on this host | Synchronous capability only. Does not test storage health, permissions, file availability or engine compatibility. |
| `loadPackages()` | Overview, details and stored-file profile selection await initial discovery | Shares the actual pending read, or reuses an already loaded list. Rejects discovery failure so the view can offer Retry. |
| `refreshPackages()` | Explicit Refresh or retry rereads package folders | Replaces the transient list only on success; preserves the last successful list on failure. Does not change a profile draft. |
| `listPackages()` | Overview and profile file selector read the loaded folders/files | Synchronous read of current memory; no I/O. An empty result before load is not proof that storage is empty. |
| `getPackage(packagePath)` | Details and Create profile look up one loaded folder | Synchronous exact-path lookup, returning undefined when absent. No discovery, registration or fallback selection. |
| `browseEngineFile(startDirectory?)` | Profile Browse awaits the chosen executable/script path | Opens the existing file dialog through the service. Returns a path only; cancellation leaves the local form intact. |
| `readArchive(file, signal?)` | Import view supplies the selected filename/original bytes and receives a decoded file review | Reads/validates without storage writes. Rejects invalid files or cancellation. Does not choose an entry/interface. |
| `installPackage(engineName, archive, signal?)` | Import confirmation supplies the frontend-validated Engine name and decoded files | Publishes to its unique folder, then refreshes. Returns packagePath for Create profile; creates no profile/installation record. |
| `removePackage(packagePath, readReferences)` | Confirmed removal supplies the folder and a current-reference reader | Checks references when its queued turn starts, deletes only stored package files and refreshes. Rejects blocked/failed deletion; it never removes profiles. |

Import, removal and discovery share the store's package-work queue, so a refresh cannot publish a list read before an issued mutation settled. Existing option discovery is not added to that queue. listPackages/getPackage read discovery results, not a persisted catalogue.

The removal caller supplies a function that reads current accepted/draft profiles and open-game assignments. Invoke it after queued work has settled, immediately before deletion, rather than keeping the list captured when Details opened. Presentation composes these inputs from SettingsStore and GamesStore; EnginesStore does not look up sibling stores. EnginePackageService checks active leases before deletion, using the same internal resource state as the Worker owner.

### EnginePackageService additions

`EnginePackageService` owns the browser-only package storage directly. There is no package adapter interface, platform getter or desktop package implementation. Its API keeps generic names; desktop profiles continue to use their actual executable/script paths.

```ts
canInstall(): boolean;
listPackages(): Promise<readonly IEnginePackage[]>;
browseEngineFile(startDirectory?: string): Promise<string>;
readArchive(file: IEnginePackageFile, signal?: AbortSignal): Promise<IEngineArchive>;
readFile(packagePath: string, relativePath: string): Promise<IEnginePackageFile>;
install(engineName: string, archive: IEngineArchive, signal?: AbortSignal): Promise<string>;
remove(packagePath: string, references: readonly IEnginePackageUsage[]): Promise<void>;
```

| Method | Caller, result and responsibility |
| --- | --- |
| `canInstall()` | EnginesStore.canInstallPackages reads the existing resolved host target. Returns true for the browser host and false for desktop; does not open storage or run a health/compatibility probe. |
| `listPackages()` | EnginesStore._readPackages requests discovery. Enumerates imported folder roots/filenames directly from IndexedDB on browser and adds the bundled package from the build asset definition. On desktop returns only that bundled definition, without scanning user paths. Per-folder read failures become warnings; enumeration failure rejects. |
| `browseEngineFile(startDirectory?)` | EnginesStore.browseEngineFile delegates to the existing IStorageAdapter.showOpenDialog for desktop executable/script selection. The platform lookup is resolved only when this page action runs. Propagates the existing picker result/cancellation. |
| `readArchive(file, signal?)` | EnginesStore.readArchive requests ZIP decoding and path/file validation. Returns IEngineArchive; writes nothing and starts no engine. |
| `readFile(packagePath, relativePath)` | The service-worker file handler reads original bytes for one stored package file directly from IndexedDB. Rejects missing/unreadable files without substituting another package. Discovery reads filenames only. This is a service operation for file serving, not a new EnginesStore or runtime API. |
| `install(engineName, archive, signal?)` | Queued import receives the frontend-validated name, validates archive files, derives the named folder and atomically writes its files to IndexedDB. Returns the folder path; EnginesStore owns discovery refresh. No repeated name-format or uniqueness validation. |
| `remove(packagePath, references)` | Queued removal checks the supplied references and active leases, claims deletion, then atomically removes that root's files from IndexedDB. Rejects unsupported, referenced, leased or failed deletion. Does not read sibling stores or delete desktop files. |

Package storage does not pass through IPlatformService. Only the existing desktop picker operation uses its storage dialog. Import/removal are unavailable on desktop; no user-engine folders are copied, registered or scanned there.

The bundled folder is read directly from the app distribution on both hosts. Its filenames come from the same build asset definition that supplies Stockfish scripts/WASM/licence files. The service adds that definition to discovery without copying its files or scanning an HTTP directory. Bundled loading uses ordinary app URLs; browser-stored user files use service-worker URLs. Neither path needs vendor metadata or a restore API.

The service's file-storage code can run in the app page or the service-worker context without constructing Pinia stores, page-platform composition or engine clients. Resolve the existing desktop-picker dependency only inside browseEngineFile, so importing the file-serving path does not bootstrap the page's platform service.

### Existing platform interfaces

```ts
// IPlatformService: retain the existing client getter and change the
// manager getter to use the same binding. No package getter is added.
getEngineClient(clientType: EngineClientType): IEngineClient;
getProcessManager(clientType: EngineClientType): IProcessManager;

// IStorageAdapter: existing contract, unchanged.
showOpenDialog(startDirectory?: string): Promise<string>;

// IProcessManager: existing lifecycle; only the path parameter wording changes.
spawnProcess(entryPath: string, args?: string[]): Promise<ProcessHandle>;
assertProcessHandleOpen(processHandle: ProcessHandle): void;
stopProcess(processHandle: ProcessHandle): Promise<void>;
restartProcess(processHandle: ProcessHandle, entryPath: string, args?: string[]): Promise<ProcessHandle>;
```

Both enum-keyed getters use one composition table pairing IEngineClient with IProcessManager. Desktop registers native and Worker pairs; browser registers its supported Worker pair. Unsupported types fail explicitly through existing error handling. A handle remains opaque and is used only with the pair selected for its owning assignment.

getEngineClient(clientType) returns the protocol/session owner; getProcessManager(clientType) returns the physical process/Worker lifecycle owner from that same pair. EngineRuntimeService calls both using the assignment's copied enum value. These getters return composed capabilities; none installs files, starts engines or resolves a profile.

### Platform composition only

After the dependency correction introduces inheritance, this package rework gives the private UCI base its registered client enum value. The subclass supplies that value through super; transport lookup remains a protected override:

```ts
// Private implementation outline; existing operations/helpers are omitted.
abstract class UciEngineClientBase {
  protected constructor(private readonly _clientType: EngineClientType) {}
  protected abstract _resolveTransport(handle: ProcessHandle): IUciTransport | undefined;
}
```

The browser subclass calls super(EngineClientType.UciWorker), and the base's private assignment guard uses that value. It receives no transport service or resolver callback. The subclass keeps the registry lookup private behind its protected hook; composition retains the existing browser Pinia façade and the matching client/process-manager pair. The restored native client factory is unchanged. This enum configuration belongs to the package rework, not the preceding dependency correction.

### Proposed private helpers

BrowserProcessManager owns _prepareEntry as a private method called only by spawnProcess. It resolves the actual script URL and retains its resources: app-shipped/desktop files use their real locations, and browser-stored files use service-worker readiness plus a package lease. Its result stays inside the process manager, which transfers the release callback to its Worker-close handler and releases on failed construction. This is not an injected entry-preparation callback, an IProcessManager operation, or an API on IPlatformService, EnginesStore or EnginePackageService. File/app URL resolution stays in the process manager; stored file reads belong to EnginePackageService. No package operation is added to the platform contract.

| Helper | Purpose and outcome |
| --- | --- |
| `BrowserProcessManager._prepareEntry(entryPath: string): Promise<{ url: URL; release(): void }>` | Private spawn helper. Returns the supplied entry URL and an owned resource-release callback; never persists either or chooses a profile. Preparation failure releases anything already acquired. |
| `EnginesStore._queuePackageWork(action)` | Serialises actual package reads/writes. Returns the action's result/failure while keeping a settled queue tail for the next action. No persistent jobs or new runtime queue. |
| `EnginesStore._readPackages()` | Calls service.listPackages and replaces the transient list only after success. Used inside queued actions so they do not queue themselves again. |
| `EnginePackageService._readPackage(packagePath)` | Builds one transient stored-folder result from the folder name and actual filenames. Per-folder read failures become warnings. No metadata parsing. |
| `EnginePackageService._listStoredPackagePaths()` | Enumerates distinct imported roots from IndexedDB file keys without loading contents or creating folder records. |
| `EnginePackageService._listStoredFiles(packagePath)` | Enumerates filenames under one exact stored root without loading contents. |
| `EnginePackageService._decodeArchive(file, signal)` | Uses the ZIP reader to turn original archive bytes into relative file paths/bytes. Returns files only; it does not infer a Worker, select a destination or install anything. |
| `EnginePackageImportView._validateEngineName(engineName)` | Private frontend form helper for name-format rules and case-insensitive uniqueness against the already loaded engine list, including the bundled folder. Supplies the inline field error and Install eligibility; submission stops on an invalid/duplicate name before calling the store. No store/service name validation is added. |
| `EnginePackageService._validatePackageFiles(archive)` | Checks the decoded file set and its path boundaries. Rejects invalid/conflicting paths without adding a manifest or starting an engine. |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` | Rejects deletion with the names of current profile/game references inside that exact folder. Active leases are checked by the service's private deletion claim. |

_readAction, _installAction and _removeAction in the tables are local callbacks passed to _queuePackageWork, not additional public APIs. Existing runtime/client helpers retain their current owners and behaviour.

The following helpers stay inside their named owner. EnginePackageServiceWorker is the app-owned worker entry point in a separate context, calling EnginePackageService for stored file reads. Registration/control stays private to BrowserProcessManager; file storage and deletion stay in EnginePackageService.

| Helper | Caller, result and ownership |
| --- | --- |
| `BrowserProcessManager._ensurePackageServing(): Promise<void>` | _prepareEntry shares registration/control readiness for stored browser files. Rejects failed readiness, clearing the settled work so Retry can start a fresh attempt. |
| `BrowserProcessManager._waitForPackageControl(registration: ServiceWorkerRegistration): Promise<void>` | The manager's readiness action waits for activation and the matching document controller. Owns its bounded wait, listeners and disposal cancellation; removes them on every settlement. |
| `BrowserProcessManager._acquirePackageLease(packagePath: string): () => void` | _prepareEntry claims a live resource lease, refusing while deletion owns that root. Returns the release callback for that Worker. |
| `EnginePackageService._claimPackageDeletion(packagePath: string): () => void` | remove claims deletion synchronously, refusing while a live resource lease exists. Returns the callback releasing that claim after transaction settlement. |
| `EnginePackageServiceWorker._onPackageActivate(event: ExtendableEvent)` | Worker-module activation callback claims the controlled page through event.waitUntil. Not an engine/store API. |
| `EnginePackageServiceWorker._onPackageFetch(event: FetchEvent)` | Worker-module fetch callback filters requests and synchronously supplies the response promise for stored-engine URLs. |
| `EnginePackageServiceWorker._resolveStoredFile(url: URL): { packagePath: string; relativePath: string }` | _servePackageFile decodes/validates the reserved URL into an exact package boundary and relative filename; rejects escaping or malformed paths. |
| `EnginePackageServiceWorker._servePackageFile(request: Request): Promise<Response>` | _onPackageFetch reads original bytes through EnginePackageService.readFile and constructs the MIME/status response. |

The page's Worker manager and package service use the same implementation-only resource state already required by leases/removal, held in a shared support module rather than obtained from a platform getter. It contains the live lease objects and deletion claims, without another class, service or callable interface. BrowserProcessManager owns lease additions/releases; EnginePackageService owns deletion claims. Each checks the other's ownership synchronously before claiming its resource. The service-worker context uses only EnginePackageService.readFile and does not access page resource state, runtime state or Pinia stores. No lease or registration operation is added to the public engine/runtime APIs.

### Existing runtime boundary

EngineRuntimeService has no API changes in this plan. Its unchanged signatures and lifecycle are not reproduced in this API design. Existing [runtime ownership](LowLevel/ProcessFlows/EngineRuntimeOwnership.md) and [engine-client contracts](LowLevel/Architecture/PlatformAbstraction/EngineClient.md) remain authoritative. Only the internal substitutions explicitly listed under [Implementation boundary](#implementation-boundary) are in scope.

Existing EnginesStore profile-selection and option-discovery APIs also retain their signatures and behaviour. Their launch-field/cache comparisons use entryPath and clientType and drop protocol as already specified. Package operations do not wrap or replace getOptions. No new cancellation parameter is added to spawnProcess or option discovery.

### Open API decisions

The first-use, naming, uniqueness, metadata and service-worker decisions are recorded in [Questions to answer before implementation](#questions-to-answer-before-implementation). The listed choices are settled. Package installation creates a unique named folder; there is no implicit replacement or separate version policy. The selected loading mechanism still requires implementation and real-engine verification after work is explicitly resumed.

File-action failures also need to retain their failing operation/stage through the existing error contract. A read/validation/transaction failure leaves no new files; a discovery failure after commit leaves the files installed and offers Refresh/Retry. The same distinction applies after a successful removal. Do not report every rejected store promise as a rolled-back file operation or add another persistence/error subsystem to hide that distinction.

## Function flows

Use the [stacked-table convention](LowLevel/ProcessFlows/index.md#conventions): each header is one caller, each row is a direct call in execution order, and follow-on tables expand delegated calls. Branches have separate tables. State writes, ownership and error behaviour sit outside the tables. Framework/storage primitives and unchanged runtime APIs are terminal boundaries here. Expand only the new or changed rework paths; retain the existing runtime lifecycle in its linked documentation. A contextual call is not an API change.

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
| `EnginesStore.loadPackages()` |

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
| `EnginesStore.loadPackages()` |
| `EnginesStore.getPackage(packagePath)` |

The details view registers its private _load callback with onMounted. For the overview, SettingsView's mount/category route-update handler explicitly invokes its private _loadEnginePackages callback for the engines category. Refresh explicitly calls refreshPackages. No watcher or polling is involved.

First load:

| `EnginesStore.loadPackages()` |
| --- |
| `EnginesStore.refreshPackages()` |

Already loaded or loading: return the current result or actual shared discovery promise; do not start another read.

| `EnginesStore.refreshPackages()` |
| --- |
| `EnginesStore._queuePackageWork(_readAction)` |

| `_readAction()` |
| --- |
| `EnginesStore._readPackages()` |

| `EnginesStore._readPackages()` |
| --- |
| `EnginePackageService.listPackages()` |

Replace the transient list only after successful discovery. Clear the actual in-flight read owner when it settles, permitting Retry after failure. getPackage finds a folder by packagePath; listPackages returns the current list.

Browser discovery branch:

| `EnginePackageService.listPackages()` |
| --- |
| `EnginePackageService.canInstall()` |
| `EnginePackageService._listStoredPackagePaths()` |
| `EnginePackageService._readPackage(packagePath)` for each stored root |

Desktop branch:

| `EnginePackageService.listPackages()` |
| --- |
| `EnginePackageService.canInstall()` |

The service includes the bundled package's build-declared root/filenames directly on both hosts. Only the browser branch reads imported file keys. Desktop returns the bundled definition without a storage scan; external paths remain profile targets without registration.

| `EnginePackageService._readPackage(packagePath)` |
| --- |
| `EnginePackageService._listStoredFiles(packagePath)` |

Construct IEnginePackage from the stored folder name, path, filenames and user source. An unreadable folder carries a warning; failure to enumerate storage is a discovery error. No file contents, name/version metadata or engine client are needed for discovery.

| `EnginePackageService._listStoredPackagePaths()` |
| --- |
| `IndexedDB files-store key cursor` |

| `EnginePackageService._listStoredFiles(packagePath)` |
| --- |
| `IndexedDB files-store key cursor restricted to packagePath` |

Distinct packagePath values in file keys are the imported folder list. Query keys only for discovery; readFile is used only for actual stored resource access, as expanded in the serving flow below.

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
| `EnginesStore._readPackages()` |

| `EnginePackageService.install(engineName, archive, signal)` |
| --- |
| `EnginePackageService.canInstall()` |
| `EnginePackageService._validatePackageFiles(archive)` |
| `IndexedDB readwrite transaction for the supplied package files` |
| `ObjectStore.put(file, [packagePath, relativePath])` for each supplied file |
| `transaction completion/abort/error events` |

The view stops submission if name-format or uniqueness validation fails, using its already loaded engine list. The service derives the managed root from the frontend-validated engineName and writes the files directly; it repeats neither name check. The store retains the returned packagePath, refreshes discovery, then returns that same path to the view for Create profile. No vendor name/version or ZIP filename determines the destination.

Reject an unsupported host and check cancellation before issuing the transaction. Once issued, the service's returned promise stays owned until the actual transaction commits or aborts. A cancellable transaction may abort, but rejecting a UI promise alone does not settle publication. Atomic commit publishes all original files; failure/abort publishes none. Discovery runs afterwards, with no catalogue or manifest publication. A discovery failure after commit reports that the files were saved and the list needs Retry; it does not claim installation rolled back.

Shared sequencing helper:

| `EnginesStore._queuePackageWork(action)` |
| --- |
| `await previous package work settlement` |
| `action()` |

Keep the actual action promise for its caller, with a settled queue tail for the next action. Each owner observes its own failure. Reads and mutations use this same queue; helpers already executing inside it call _readPackages directly rather than recursively queueing and deadlocking. This is in-memory operation ownership, not a new persisted queue.

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
| `EnginesStore._readPackages()` |

| `EnginePackageService.remove(packagePath, references)` |
| --- |
| `EnginePackageService.canInstall()` |
| `EnginePackageService._assertPackageUnreferenced(packagePath, references)` |
| `EnginePackageService._claimPackageDeletion(packagePath)` |
| `IndexedDB readwrite transaction deleting file keys under packagePath` |
| `transaction completion/abort/error events` |

Reject an unsupported host before file work. _assertPackageUnreferenced checks compatible virtual entry paths by exact package boundary, not string-prefix coincidence; native executable targets are not managed package references. Pass named references back to the view when blocked. Do not delete/retarget profiles or assignments.

The service claims deletion synchronously before asynchronous file work, refusing active leases. Invoke its returned claim-release callback in finally after transaction settlement. Only managed browser package files are removed; desktop executables and package folders are never deleted.

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

The client lookup already takes clientType. Add that argument to the manager lookup at the listed call sites so startup, handle checks and release use the same registered pair. Never infer the pair from a handle or package source.

### Worker creation and stored-file serving

Native Uci processes retain their existing spawn/transport implementation; only the path parameter wording follows entryPath. No executable copying, package registration or native lifecycle change is added.

UciWorker branch, using the existing BrowserProcessManager with private entry preparation:

| `BrowserProcessManager.spawnProcess(entryPath, args)` |
| --- |
| `BrowserProcessManager._prepareEntry(entryPath)` |
| `BrowserProcessManager._createWorker(prepared.url)` |
| `new BrowserUciTransport(worker, _onWorkerClosed)` |

Reject unsupported arguments before preparation. BrowserProcessManager._prepareEntry returns the real URL/resource release callback; the chosen entry keeps its upstream name/layout. Record the new handle/transport in the manager's private _registry immediately after construction. _createWorker is the existing private constructor-supplied Worker factory. _onWorkerClosed is a local closure passed to the transport's existing private _onClosed callback field; neither is another public method. Failed Worker/transport construction terminates any created Worker and releases prepared resources before returning the existing process-start error. A successful spawn transfers that release callback to _onWorkerClosed. Remove the old Stockfish alias/path special case.

App-shipped or desktop file branch:

| `BrowserProcessManager._prepareEntry(entryPath)` |
| --- |
| `new URL(resolvedEntryPath, appBaseUrl)` |

Desktop resolves external paths using its existing filesystem capabilities. Bundled entries keep their app URL. This branch needs no browser package-service registration or stored-file lease; return the resolved URL and the corresponding resource release callback.

Browser-stored user package branch:

| `BrowserProcessManager._prepareEntry(entryPath)` |
| --- |
| `BrowserProcessManager._ensurePackageServing()` |
| `BrowserProcessManager._acquirePackageLease(packagePath)` |
| `new URL(encodedPackageFilePath, appBaseUrl)` |

Resolve the virtual entry into its exact user package root and relative path. Encode each path component into the reserved engine-files URL, retaining the directory hierarchy. Return that URL and the acquired lease's release callback. Release an acquired lease if later preparation fails. The lease lasts until Worker closure, covering later relative asset requests as well as initial script/WASM loading. Missing files remain normal launch errors, not installation/profile-save probes.

Initial registration or retry branch:

| `BrowserProcessManager._ensurePackageServing()` |
| --- |
| `navigator.serviceWorker.register(appServiceWorkerUrl, { scope: appBaseUrl })` |
| `BrowserProcessManager._waitForPackageControl(registration)` |

Share the actual pending readiness promise; do not duplicate registration waits. If the matching active registration already controls the document, return without another wait. Unsupported/failed registration rejects through existing process-start handling. A failed attempt clears its operation owner so another engine retry can try again.

| `BrowserProcessManager._waitForPackageControl(registration)` |
| --- |
| `navigator.serviceWorker.addEventListener('controllerchange', _onControlChanged)` |
| `installingWorker.addEventListener('statechange', _onStateChanged)` when activation is pending |
| `setTimeout(_onReadinessTimeout, readinessTimeoutMs)` |

The underscore-prefixed listener/timer callbacks are local to this owned wait. Install listeners before checking current state to close the observation gap. Resolve only when the active worker for this registration controls the current app document; a different registration's controller is insufficient. Reject activation failure, timeout or platform-owner disposal. Remove listeners and clear the timer on every outcome. This is one bounded, event-owned wait, without polling or generation counters. spawnProcess retains its existing public signature and captures any late successful handle for normal disposal.

App-owned service-worker activation:

| `EnginePackageServiceWorker module initialisation` |
| --- |
| `self.addEventListener('activate', _onPackageActivate)` |
| `self.addEventListener('fetch', _onPackageFetch)` |

The worker module registers its own private event callbacks; the page/process manager does not call them directly.

| `EnginePackageServiceWorker._onPackageActivate(event)` |
| --- |
| `self.clients.claim()` |
| `event.waitUntil(claimPromise)` |

Claim clients within the registration's app scope so the first stored-engine launch does not require a manual page reload. Let the browser retain the shared registration across engine stops; individual package disposal does not unregister it.

Serving the engine entry and its relative assets:

| `EnginePackageServiceWorker._onPackageFetch(event)` |
| --- |
| `new URL(event.request.url)` |
| `EnginePackageServiceWorker._servePackageFile(event.request)` for the reserved same-origin engine-files path |
| `event.respondWith(responsePromise)` synchronously for that path |

Requests outside the reserved prefix use the ordinary network/app path, including the directly loaded bundled engine. The app page must be controlled before the dedicated Worker is created so its entry request can reach this handler. No app-shell caching or catch-all route response belongs here.

| `EnginePackageServiceWorker._servePackageFile(request)` |
| --- |
| `new URL(request.url)` |
| `EnginePackageServiceWorker._resolveStoredFile(url)` |
| `EnginePackageService.readFile(packagePath, relativePath)` |
| `new Response(file.data, responseOptions)` |

| `EnginePackageService.readFile(packagePath, relativePath)` |
| --- |
| `IndexedDB readonly files-store get([packagePath, relativePath])` |

Decode URL components once and reject invalid names, encoded separators or paths escaping the selected package. The URL maps to actual files, not an installation id or generated manifest. GET responses supply original bytes with a MIME type derived from the filename, including text/javascript for scripts and application/wasm for WASM, and no-store caching. The worker entry point calls EnginePackageService.readFile, which reads IndexedDB directly. This path does not initialise page-platform composition, application stores or engine clients.

Malformed paths, absent files, unsupported methods and storage failures produce explicit HTTP errors. Never substitute the app HTML page, another engine or a network-fetched replacement. The existing Worker/transport/client error flow reports loading failures and releases the package lease through the manager's _onWorkerClosed callback. A missing sibling resource therefore fails that engine's normal startup rather than leaving a partially initialised session silently running.

The build emits the service-worker handler as an app-owned asset at its stable app-relative URL for both development and production. Its filename is unrelated to vendor entry filenames. File storage schema and package names remain the current unreleased format; this adds no migration helper or persisted loading descriptor.

| `browser IEngineClient implementation: BrowserUciEngineClient constructor(registry)` |
| --- |
| `super(EngineClientType.UciWorker)` |

The preceding correction owns the private inheritance and Pinia binding design. This package change replaces its fixed Uci guard with the registered enum value supplied to the base. The concrete subclass keeps its registry private and overrides the protected lookup; no service/resolver is passed to the base. The restored native client does not inherit this base. No separate protocol discriminator is added.

The base's only package-rework change is that enum parameter and assignment guard. Existing handshake, option application, analysis/player operations, parsing, stop acknowledgement and session cleanup remain unchanged; they are not expanded here. Worker writes still use Worker.postMessage(command), and string message events still feed the existing client parser.

### Worker resource release

Existing runtime stop/restart/disposal reaches the process manager through its unchanged lifecycle. Only the enum-keyed manager lookup changes as listed above. The Worker-specific resource release added by this rework is expanded below.

Worker physical shutdown:

| `BrowserProcessManager.stopProcess(handle)` |
| --- |
| `BrowserProcessManager._requireTransport(handle)` |
| `BrowserUciTransport.terminate()` |

| `BrowserUciTransport.terminate(detail)` |
| --- |
| `Worker.removeEventListener(...)` for message/error/messageerror |
| `Worker.terminate()` |
| `BrowserUciTransport._onClosed()` |
| `registered exit listeners(detail)` |

| `BrowserProcessManager.spawnProcess: local _onWorkerClosed()` |
| --- |
| `prepared.release()` |

The transport invokes its private _onClosed callback field, which is the manager's passed _onWorkerClosed closure. That closure deletes the handle from the manager's private _registry before releasing prepared resources. terminate marks the transport closed before callbacks, retains exit detail, then clears listener sets after exit notification. Repeated termination is a no-op. Existing Worker error/messageerror handlers enter this same termination path. Failed startup, normal stop, crash and restart therefore release the actual prepared resources, while other assignments keep their own handles/leases. Stored-engine URLs use the selected service worker; _onWorkerClosed releases the package lease without unregistering that shared handler. Runtime verification remains outstanding.

## Current contract changes and delivery

Remove engine `protocol`, `EngineProtocol`, `engineProtocols` and `engineProtocolSchema` from contracts/schemas, copies/defaults, option-cache keys, imports/fixtures and the read-only Protocol row as the current EngineProfileModal form moves into the page editor. Retain unrelated `URL.protocol` checks. Update only references required by the specified launch-field, enum, default and protocol-removal changes in callers, fixtures and architecture examples. Preserve the [implementation boundary](#implementation-boundary); this does not authorise runtime API changes or surrounding refactors.

Keep settings, saved-game and unrelated session/layout documents at their initial schema version. The app is unreleased; change the current readers, writers, defaults and fixtures together. There are no migration helpers, version branches, alias mappings or compatibility representations. No package-manifest schema exists.

Profiles and assignments store the exact entry path, client type, label and options. Exports omit engine binaries and runtime state. Parsing a saved game does not start an engine or import package files. Missing files or a foreign-host path remain current-format availability errors with explicit relink.

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 0. UI review | Actual entry-file selection, desktop direct paths, browser-only import | Validated unique engine name/folder, no version field, no assumed entry filenames/manifests or desktop installation. |
| 1. Runtime proof | Real Stockfish plus an independent worker using upstream layouts | Direct bundled files and service-worker-served imports load their actual scripts/relative assets; initial control, reload, normal runtime operations and cleanup pass. |
| 2. Current contracts | Entry path, single client enum, source enum, protocol removal | Exact paths/options round-trip without installation ids or new package metadata. |
| 3. Package files | Desktop reads; browser discovery/import/removal | No package writes on desktop, browser list reconstructs from files, the frontend blocks duplicate names using that list and cancelled/failed import publishes nothing. |
| 4. Composition/defaults | Matching client/resource owners, ordinary bundled files/profile | Native/browser runtimes coexist with isolated stop/crash/restart; default uses same loader. |
| 5. Acceptance | Forms, focused tests, browser/NW.js journeys and architecture docs | Exact entry selection, Apply/Cancel, recovery and reference checks; separate simulation from real runtime results. |

Cover unique/invalid engine names, folder-name display, ambiguous multi-build archives, Node-only metadata entries, helper-worker confusion, different layouts/names, absent scripts/assets, path traversal, external changes, missing/foreign-host paths, cancellation/disposal and ignored protocol removal. Run `npm run check:code`, focused Vitest suites, affected Playwright journeys and `npm run build` after implementation. Real NW.js mixed-engine acceptance remains required. This is a plan and simulated design, not implemented engine loading.
