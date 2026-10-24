# Engine targets, browser packages and profiles

Prepared on 23 October 2026; revised on 24 October 2026. Status: planned. See the [UI specification](EngineManagementUiDesign.md) and [clickable preview](design/EngineManagement.html).

## Agreed model

Desktop profiles point directly to an executable or the entry file inside a browser engine package, wherever the user keeps it. Selecting a package folder lets the user choose its entry script. There is no desktop installation, registration or engine catalogue.

- Browser import stores the supplied package files, preserving their relative layout. Discover imported packages by reading those folders, without separate installation records.
- Require neither a fixed entry filename nor a new manifest. Upstream archives do not generally contain a ChessVue manifest. Do not generate one during browser import or modify desktop folders.
- Existing package metadata may provide a name/version. It is not guaranteed to declare a usable browser entry or its interface. Ask for missing launch information explicitly; never guess the first JavaScript file or assume an npm `main` is a Worker.
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

Check exact-build readiness, option support, active-search interruption, pondering and infinite analysis independently. The [Lozza fork originally examined](https://github.com/namanthanki/lozza/blob/main/README.md#limitations) documents missing `stop`; that finding is build-specific, not a universal Lozza guarantee. Preserve the existing stop/drain contract.

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
export interface IEngineRecord {
  id: string;
  displayName: string;
  launch: IEngineLaunch;
  options: IEngineOptionMap;
}
export type IEngineSelection = Omit<IEngineRecord, 'id'>;
export interface IAssignedEngine extends IEngineSelection {
  $?: IAssignedEngineRuntime;
}
export interface IBrowserEnginePackage {
  packagePath: string;
  displayName: string;
  version?: string;
  source: EngineInstallationSource;
}
```

`entryPath` is the actual launch target: native executable for Uci, supplied browser entry script for UciWorker. Desktop accepts user paths or app-relative bundled paths. Browser uses virtual file paths in its package filesystem. Other future clients interpret their entry according to that implementation. There is no additional execution-kind enum or protocol selector.

`IBrowserEnginePackage` is a transient folder-discovery result, not a persisted record. Read existing `package.json` name/version where present; otherwise display the folder name without inventing a version. Derive source from the bundled/user storage namespace. Source uses `EngineInstallationSource` and never selects the runtime.

The profile stores launch information because the user chose that target. Imported package storage holds only package files. There is no installation id, catalogue, saved entry-selection registry or generated loading descriptor. Several profiles can target one script with different options, or different builds inside the same folder.

Copy nested launch/options data into assignments. External desktop files can change or disappear: validate the actual target at use, invalidate transient option caches when it changes and preserve unavailable paths for explicit repair. Do not promise immutable external bytes or substitute another build silently.

## Package reading and entry selection

Preserve the upstream folder structure, script names and auxiliary resources. Browser import accepts the archive's actual layout; desktop users may extract it anywhere and point a profile at the executable/package entry. No required `assets` subdirectory or renamed entry is introduced.

1. Read existing small metadata files where applicable to show package information. This does not prove a browser launch contract.
2. If a supported metadata format unambiguously identifies a compatible entry, offer that file as a confirmed choice. Generic npm `main`, `browser` and `exports` fields are not automatically interchangeable or necessarily Worker-safe.
3. Otherwise show the actual candidate files and ask the user to select the intended entry and implemented interface. Do not choose a helper worker merely because of its filename. Unsupported module APIs remain unsupported until the matching client/adaptation exists.
4. Probe the selected target at the explicit profile/import action boundary; derive engine identity and options through that client. Keep probe results transient. The profile name is the user's saved label.
5. Launch the chosen entry with its required assets and platform requirements. A message-compatible script is not proof of full player/analysis lifecycle support.

On desktop, selecting/checking a target writes no package files. In browser, import review can collect an entry to check and seed Create profile immediately after import. That temporary selection is not persisted as installation metadata. Later profile creation asks again when the files do not identify an unambiguous entry. Done may leave an imported folder with no profiles.

The loader must preserve or explicitly support the build's relative imports, WASM/NNUE resolution, MIME types and host requirements. Do not assume every vendor entry accepts an app asset-map bootstrap or that Blob workers inherit a package directory. Prove actual Stockfish and an independent worker before fixing the serving mechanism. See [Worker construction](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) and [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

A real resource lease retains worker/asset URLs until their consumers terminate. Release on failed startup, cancellation, crash, restart and disposal. Never save Blob URLs, workers or picker handles in profiles.

## Retrieval without a catalogue

| Target | Retrieval | Persisted data |
| --- | --- | --- |
| Desktop executable | Use the profile's exact executable entry path | Profile/assignment launch data and options |
| Desktop browser engine | Use the profile's supplied script path; resolve its required neighbouring/package resources | Profile/assignment launch data and options; no copy or registration |
| Bundled desktop engine | Same file reader and client, using the default profile's actual entry | Ordinary default profile |
| Imported browser package | Enumerate package directories/file keys; read existing metadata when present, otherwise folder name | Original package files and relative layout |
| Browser engine profile | Resolve its exact virtual script path inside the discovered package folder | Profile/assignment launch data and options |

Browser storage can use a dedicated `chessvue-engines` IndexedDB database, with files keyed by `[packagePath, relativePath]`. Package-root keys define folder boundaries. Enumerate distinct roots, then read existing small metadata files without loading WASM/NNUE bytes. A successful import of a valid engine contains files, so no independent folder/installation record is required. Bundled/user roots determine the source enum. See the [IndexedDB documentation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Do not create an installations object store, catalogue singleton, generated package manifest or remembered-entry table. Desktop has no managed user-engine root to scan. Browser package discovery does not start engines to fill a list; identity/options probes belong to explicit user actions.

| Boundary | Responsibility |
| --- | --- |
| Platform package adapter | Desktop reads selected files/folders. Browser lists/reads/imports/removes stored package files. Expose only supported host operations. |
| `EnginePackageService` | List package folders and candidate files; read existing metadata through the adapter, isolating unreadable folders into warnings. No native registration lookup. |
| `EnginesStore.loadBrowserPackages()` / `refreshBrowserPackages()` | Own/share browser discovery at startup and explicit import/removal/Refresh/focus actions. Preserve profile drafts; no watchers or polling. Desktop profiles do not depend on this list. |
| Profile/import target action | Collect exact entry and `EngineClientType`; validate/probe through layer-2 services and own cancellation. |
| Selection resolution | Validate copied entry path, host and requested role at assignment/launch; return `Promise<IEngineSelection>`. Preserve the form on failure. |
| Asset preparation | Read the selected entry and required resources, acquiring a real lease. Derive browser package boundary from its virtual path, not a registry id. |

```text
Desktop profile -> executable entry -> native client/process
Desktop profile -> supplied JS entry -> matching browser client
Browser profile -> stored virtual entry -> same browser client
```

## Browser import and defaults

Only browser hosts need import/removal. `EnginesStore` coordinates package storage through `EnginePackageService` and temporary probes through `EngineRuntimeService`; those layer-2 services do not call each other.

1. An explicit import owns its picker, abort controller and staging work; prevent duplicate starts.
2. Validate archive paths and layout, list actual entry candidates, collect the user's supported interface/entry choice, and check necessary assets/host requirements. No new manifest is required or generated.
3. Probe the chosen entry's startup/options and intended role lifecycle, then release the temporary runtime.
4. Publish all original files atomically in one IndexedDB transaction, preserving relative paths. Use a separate virtual folder for different content; no metadata/catalogue publication follows.
5. Refresh discovery. Failed/cancelled work publishes nothing. Settle an issued publication even if the initiating UI closes. Create profile may use the action's captured entry choice; Done retains files only.

Cancel/settle superseded checks before replacement work. Serialise conflicting publication/discovery. Browser package removal checks committed/draft profile entries, open-game assignments and active leases inside the folder. A draft-only profile deletion still blocks removal until Apply. Removal never touches desktop files or automatically rewrites profiles/games.

The build supplies Stockfish's original script/assets in a normal bundled folder. Its default profile/configuration names the actual entry; no special client branch or manifest is needed. Desktop reads it directly. On first browser package-database creation, import those files through the ordinary pipeline into the bundled namespace. Existing empty storage is intentional, so reload does not continually reseed it. Failed setup offers Retry/Restore.

Desktop Use included Stockfish fills the default script path. Browser Restore included engine reimports the supplied files if missing. Settings reset restores default profiles and ensures that entry resolves, while keeping unrelated browser packages and desktop files. App updates do not silently rewrite saved targets.

## Mixed runtime and UI

Host selection happens once. Its binding table is keyed only by `EngineClientType`, pairing each client with its matching lifecycle backend:

```text
EngineRuntimeService -> binding for launch.clientType
  Uci       -> native process manager -> launch.entryPath
  UciWorker -> package/file loader    -> launch.entryPath
```

Desktop offers native and supported browser bindings together, including within one game. Browser offers its implemented browser bindings. Preserve `getEngineClient(clientType)` and obtain the matching lifecycle backend from the same table, avoiding independent switches. Bind each opaque handle to its actual owner for stop/restart/disposal; do not parse handles.

Share the current UCI state machine through `IUciTransport` where appropriate, parameterising the hard-coded Uci guard while preserving ownership. Other interfaces can implement `IEngineClient` directly. Preserve turns, pondering, analysis stop acknowledgement, supersession, pause/deferred-result and legality semantics. Each assignment owns its runtime; share package bytes, not sessions. Verify actual [NW.js worker configuration](https://docs.nwjs.io/References/Command%20Line%20Options/) and packaging.

Desktop Settings shows profiles and behaviour; Add/Edit selects an executable or browser entry file. Browse package can expose its script candidates. Browser adds the discovered package-folder list and import/remove controls, then profile entry selection. Both retain name/options and Apply/Save/Discard. Existing foreign-host/native targets remain visible and repairable. Profile deletion changes configuration only. Game selectors use accepted profiles and copy exact launch data/options.

Follow the [UI specification](EngineManagementUiDesign.md), existing `.vue` ownership and shared global CSS. No new watchers, component style blocks or scope escapes.

## Protocol removal, migration and delivery

Remove engine `protocol`, `EngineProtocol`, `engineProtocols` and `engineProtocolSchema` from contracts/schemas, copies/defaults, option-cache keys, imports/fixtures and the read-only Protocol row in `EngineProfileModal`. Retain unrelated `URL.protocol` checks. Update affected runtime/store/composable/modal/journey utilities and architecture examples during implementation.

Introduce settings/saved-game version 2; leave unrelated session/layout versions unchanged. No package-manifest schema version is needed.

- Pure shared migration helpers serve `UserSettingService` and `SerializationService`; ignore legacy engine protocol values and omit them on new saves.
- Native records retain their exact executable as `entryPath`, with no install/registration side effect.
- Exact legacy `stockfish.js` aliases map to the supplied default entry and `UciWorker`; browser storage initialisation stays separate from document conversion.
- Preserve ambiguous legacy worker paths/URLs and options with an explicit repair state. Do not invent missing resources or import packages while reading a saved game.
- Export copied entry paths, client type and options, not engine binaries. Preserve moves/clocks/analysis even when launch targets are unavailable. Relink only through an explicit profile/assignment action.

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 0. UI review | Actual entry-file selection, desktop direct paths, browser-only import | No assumed filenames/manifests or desktop installation. |
| 1. Runtime proof | Real Stockfish plus an independent worker using upstream layouts | Different supplied entries and assets load from desktop and browser storage; role lifecycle verified separately. |
| 2. Contracts/migration | Entry path, single client enum, source enum, protocol removal | Exact paths/options round-trip without installation ids or new package metadata. |
| 3. Package files | Desktop reads; browser discovery/import/removal | No package writes on desktop, browser list reconstructs from files, cancelled/failed import publishes nothing. |
| 4. Composition/defaults | Matching client/resource owners, ordinary bundled files/profile | Native/browser runtimes coexist with isolated stop/crash/restart; default uses same loader. |
| 5. Acceptance | Forms, focused tests, browser/NW.js journeys and architecture docs | Exact entry selection, Apply/Cancel, recovery and reference checks; separate simulation from real runtime results. |

Cover absent package metadata, ambiguous multi-build archives, Node-only metadata entries, helper-worker confusion, different layouts/names, absent scripts/assets, path traversal, external changes, missing/foreign-host paths, cancellation/disposal and ignored protocol migration. Run `npm run check:code`, focused Vitest suites, affected Playwright journeys and `npm run build` after implementation. Real NW.js mixed-engine acceptance remains required. This is a plan and simulated design, not implemented engine loading.
