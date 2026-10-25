# Engine management UI design

Proposed on 23 October 2026; revised on 25 October 2026 for the [engine rework](EngineInstallationReworkPlan.md). Status: design. The [clickable prototype](design/EngineManagement.html) uses sample data and simulated file picking, package reads and imports. It does not implement real engine loading.

The rework's [implementation boundary](EngineInstallationReworkPlan.md#implementation-boundary) applies here: change only explicitly specified UI/integration behaviour and preserve everything unmentioned. EngineRuntimeService keeps its existing APIs and lifecycle; calls from these views do not authorise runtime changes.

Open the HTML file in a browser. Documentation-only preview controls select desktop/browser, ready/missing/empty/invalid-archive states and light/dark/system appearance.

Review the [profile editor](design/EngineManagementPackage.png), [package import](design/EngineManagementInstall.png), [narrow editor](design/EngineManagementMobile.png) and [dark editor](design/EngineManagementDark.png) alongside the clickable prototype.

## Page layout

Profile editing, package import and package details are real routed views. SettingsView remains the shared route parent and renders its child through RouterView. The current URL selects the mounted view; no active-editor flag, modal handle or hidden overview implements navigation. Each view owns its form and lifecycle. The Settings navigation remains visible and long forms scroll normally.

Back to engines/Cancel uses router navigation to /settings/engines. Add/Update writes only the Settings draft and replaces the editor route with the overview; Apply/Save/Discard remains on that overview. Browser Back/Forward and direct URLs mount the matching view. Package imports still take effect separately from profile/settings changes.

Reserve modals for simple confirmations and single-choice pickers, such as deleting files, discarding settings or selecting one saved analysis profile. Do not put profile fields, repeated engine options or import review steps in a modal.

## Routes and view ownership

| URL | Route name | View |
| --- | --- | --- |
| /settings/engines | settings | Existing SettingsView engine overview |
| /settings/engines/profiles/new | engine-profile-new | EngineProfileView.vue |
| /settings/engines/profiles/:profileId/edit | engine-profile-edit | EngineProfileView.vue |
| /settings/engines/profiles/:profileId/copy | engine-profile-copy | EngineProfileView.vue |
| /settings/engines/packages/import | engine-package-import | EnginePackageImportView.vue |
| /settings/engines/packages/details?packagePath=... | engine-package-details | EnginePackageDetailsView.vue |

Create profile from a package uses the new-profile route with a packagePath query hint. Import creates a folder from the user-entered unique Engine name. The path identifies original files, not an installation record. Entry/interface/options are not stored in the URL. Progress and success are states of the import view, not modal pages.

Retain the existing Settings route and add engine child routes with the same category parameter, constrained to engines. Proposed registration in src/router/index.ts:

```ts
{
  path: '/settings/:category(session|gameplay|appearance|engines)',
  name: 'settings',
  component: () => import('../views/SettingsView.vue'),
  children: [
    { path: '/settings/:category(engines)/profiles/new', name: 'engine-profile-new', component: () => import('../views/EngineProfileView.vue') },
    { path: '/settings/:category(engines)/profiles/:profileId/edit', name: 'engine-profile-edit', component: () => import('../views/EngineProfileView.vue') },
    { path: '/settings/:category(engines)/profiles/:profileId/copy', name: 'engine-profile-copy', component: () => import('../views/EngineProfileView.vue') },
    { path: '/settings/:category(engines)/packages/import', name: 'engine-package-import', component: () => import('../views/EnginePackageImportView.vue') },
    { path: '/settings/:category(engines)/packages/details', name: 'engine-package-details', component: () => import('../views/EnginePackageDetailsView.vue') },
  ],
}
```

The absolute child patterns retain category for the existing Settings shell and match only engine URLs. The parent shows its normal category content when no child is matched; otherwise RouterView mounts the named child. Key that outlet by the child route's fullPath so changing the edited profile/query ends the previous form owner. Remove EngineProfileModal/IModalHandle opening and closing from this path. Keep the existing NavigationFrame, SettingsStore and global CSS.

The parent stays mounted between engine routes, preserving the Settings draft and existing leave/discard guard. Child navigation does not apply or discard settings. Leaving Settings retains the existing confirmation for pending settings changes. The profile view copies its selected draft record by id; Add/Update commits that local copy to the draft, while Back/Cancel or history navigation abandons only the local form. A missing id shows Profile not found with a return link.

Direct links and reload initialise the view from current settings/package files without a preceding list click or hidden opener state. Reload has the existing accepted-settings behaviour; no editor draft or import-stage persistence is added. These transient routes do not expand the saved-session route/schema or start engines/imports on entry.

EnginePackageImportView owns its file action through onBeforeRouteLeave and onBeforeRouteUpdate. Before leaving, abort/settle a read; if publication has already been issued, await its actual completion before allowing navigation. Browser Back and links use the same guard. No counters, watcher or route flag replaces that operation owner. A direct desktop visit uses the existing installation capability to explain why import is unavailable.

The documentation prototype uses the installed Vue and Vue Router, with distinct components mounted through RouterView. Hash history keeps the static HTML preview directly navigable; the application retains its existing web history. Files and engine operations remain simulated.

## Settings by host

Desktop shows Engine profiles and Analysis behaviour. Profiles point to executables or the actual entry files inside browser engine packages. There is no desktop installed-engine catalogue, registration or Install engine action. Browse opens the ordinary file dialog for the executable/script; the interface is chosen separately in the profile form.

Browser adds Installed browser engines above those sections. `EnginesStore.refreshPackages()` owns folder discovery through `EnginePackageService`. The service owns engine package operations, using a private generic stored-file Worker library over the existing IndexedDB storage; no package platform interface or desktop storage implementation is added. Bundled filenames come from the app build asset definition. These are proposed generic package APIs on both hosts; results use IEnginePackage. Choosing a stored file updates the local entryPath directly. Browse calls the proposed browseEngineFile(startDirectory?) action, which returns the chosen executable/script path through the existing platform file dialog. Show optional import controls from canInstallPackages(), without host-specific store/service calls. Display the folder name as the engine name. There is no separate version or upstream name/version lookup. Do not require or generate loading manifests, catalogue rows or remembered-entry metadata. A folder's presence does not prove which script is its entry.

```text
DESKTOP / Settings / Engines

Engine profiles                                      [+ Add profile]
Reusable engine targets and options for games.

Stockfish                                    [Copy] [Edit] [Delete]
Browser engine / .../stockfish-19-lite-single.js
Default engine options

My desktop engine                            [Copy] [Edit] [Delete]
Desktop executable / C:\Engines\engine.exe
Hash 128

Analysis behaviour
[x] Resume assigned analysis engines after restore

All profile changes saved                    [Cancel] [Save] [Apply]
```

Browser package rows show the engine folder name, Included with ChessVue or Imported package source, file availability and Create profile/Details. Remove is available only for imported user folders. Show script candidates when choosing a target; do not imply that every file is an executable engine. Refresh preserves profile edits; discovery errors show Retry rather than an empty-list success.

Reuse the Settings shell, current palettes, serif headings, shared fields/buttons and accessible Copy/Edit/Delete controls. Source is an enum in contracts, rendered as user-facing text. No client enum values, digests or separate version field in ordinary rows.

## Desktop profile form

```text
Settings / Engines / Add profile
[Back to engines]

Add engine profile
Choose an executable or the entry script inside a browser engine package.

Profile name
[My engine                                                       ]

Engine target / interface
[Desktop executable v]         alternative: Browser UCI Worker

Executable path
[C:\Engines\engine.exe                                          ]
                                              [Browse executable]
The executable stays in its current location.

Options                                            [+ Add option]
[Hash                         ] [128                    ] [Remove]

Apply or Save on Settings to keep this profile.
                                               [Cancel] [Add profile]
```

For Browser UCI Worker, show Engine entry script, Browse entry script and Use included Stockfish:

```text
Engine entry script
[D:\Chess\Engines\lozza\lozza.js                                ]
                       [Browse entry script] [Use included Stockfish]

Choose the supplied engine script inside its unpacked package.
Keep its original files and layout.
```

There is no prescribed entry filename or app-specific manifest. Stockfish, Lozza and tomitankChess keep their supplied names. The file dialog lets the user navigate into the unpacked folder and choose the actual script. It returns a file path only. Ask for the entry explicitly; an npm `main` may be a Node wrapper and must not silently become a Worker target. If multiple builds or helper files exist, ask the user which entry to run. An unsupported module API needs another implemented client, not a rename.

Save the selected entry path, `EngineClientType`, name and options in the profile. This is launch configuration, not an installation record. No extra implementation/protocol enum is introduced. For the initial clients, labels map to Uci and UciWorker; future supported interfaces add values to that same selector. Remove the current Protocol row.

Use included Stockfish fills the actual supplied script path. Adding a target neither copies files nor writes metadata into its folder. ZIP users on desktop extract their package wherever they choose, then select its entry. Existing relative assets remain in their supplied layout.

Browse cancellation leaves the form intact. Keep the existing nonempty/unique-name validation. Save the selected path and interface without checking file availability or starting an engine. Existing getOptions and runtime error handling remain unchanged. Unavailable paths and configured options stay editable.

Copy creates a local target/options copy with a unique name. Add/Update returns to the Settings draft. Delete removes that draft configuration only. Apply/Save persists profile changes; executable/package files remain user-managed and open games retain their copied configuration.

## Browser profile form

Choose Engine entry script from actual files grouped by imported package. Keep the supported interface selector explicit. A package may have several engine builds and helper scripts, so the folder alone is not a launch target. Show a blank Choose the engine entry script choice when no selection was provided. Do not choose the first JavaScript file automatically.

Several profiles may target one entry with different options, or different entries in one package. Existing native/external-desktop paths remain visible on browser with their unavailable reason and explicit relink. Changing a profile does not rewrite existing game assignments.

The included package is available directly from app files even when no user packages are stored. Keep the profile form editable. Back to engines returns to the package section and its Install action. Package import and profile editing remain separate; importing does not require or remember an entry/interface choice.

## Browser import

Install browser engine opens the import page within Settings, with an Engine name input, ZIP picker and file review. There is no Desktop executable installation tab. Preserve all original package paths and files; create no new loading manifest or catalogue record.

```text
Settings / Engines / Install browser engine
[Back to engines]

Install browser engine
Package imports take effect immediately. Profiles are saved separately.

Engine name
[Training engine 2                                              ]
This is the installed folder name and must be unique.

Choose an engine archive                         [Choose package]

Selected file    training-engine.zip
Folder          Training engine 2
Files           Original package files and relative layout

Create a profile after import to select its entry and interface.

                                           [Cancel] [Install engine]
```

| State | Content/actions |
| --- | --- |
| Loading engine folders | Read current folder names, including the bundled engine; Install disabled |
| Folder discovery failed | Retain any previous list with a discovery error and Refresh/Retry; Install disabled |
| No file | Choose package; disabled Install engine |
| File selected | Original files and user-entered engine/folder name; Install enabled only after successful discovery, with a valid unique name and no pending file/discovery action |
| Invalid/duplicate name | Inline field error identifying the invalid characters or existing engine; Install disabled |
| Reading | Read and validate package paths/files; Cancel allowed, no invented percentage |
| Publication | Save the original package files atomically; Back and Cancel are unavailable until settlement |
| Success | Import complete; Done or Create profile |
| Failure | Specific archive/path/storage error, Retry or another selection; no partially listed folder |
| Files saved, refresh failed | Explain that installation completed; keep Install disabled and offer Refresh/Retry discovery without publishing the files again |

The frontend owns both name-format and uniqueness validation using the [folder-name rules](EngineInstallationReworkPlan.md#installed-engine-names) and its already loaded engine list, including the bundled folder. It owns inline errors/Install eligibility. The folder and displayed engine name are identical; a user may include a version in that name. Store and service calls receive the validated name without repeating either check. ZIP selection/decoding is independent of this input, so editing the name does not require decoding again. This is the package installation name, not a profile label.

The import view owns a fresh discovery action on mount, including direct URLs; it does not depend on the parent overview. An empty list before success or a retained list after failure cannot enable Install. Initial loading, refresh failure and publication close a local discovery-ready gate. Only successful discovery reopens it. After an installed folder's refresh fails, Retry rereads folders without reinstalling; after a failed write, refresh and revalidate before another Install. No backend name validation, watcher or new store API is added.

Import stores package files without an entry/interface choice or engine execution. Entry and interface belong to the separate profile form. Engine startup and errors use the existing runtime when that profile is used.

Create profile opens the profile form for the imported folder, where the user chooses its entry and interface. It does not create/apply a profile automatically. Done leaves only the imported files. No upstream name/version metadata is read.

## Draft and storage boundaries

| Action | Profiles/settings | Engine files |
| --- | --- | --- |
| Desktop select target | Local form only | Read only, no installation or metadata write |
| Add/Update/Copy/Delete profile | Settings draft | No change |
| Apply/Save | Persist draft; Save leaves via existing Settings flow | No desktop file changes |
| Cancel/discard | Restore accepted profile/behaviour settings | Completed browser imports remain |
| Browser import/remove | Do not apply profile draft | Immediate package-file operation |

Dirty-leave copy explains that profile changes have not been applied and completed browser imports remain installed. Validation/persistence failures keep the draft open with a repair action. Back/Cancel in the editor discards only that local form.

## Browser details, removal and recovery

Details opens a routed view showing the engine folder name, source, files and referencing profiles/games. There is no separate version field. Details reports stored files and references, without an engine-capability classification.

Removal checks accepted/draft profile entries and open-game assignments under that virtual package root. A draft-only profile deletion still blocks removal until Apply. Blocked removal names references and offers Close/Show profiles. Unused removal confirms deletion of browser-stored files and explains that closed games may need reimport. Recheck these references when queued deletion starts; never delete profiles or retarget games automatically. Native profiles are not browser package references. Temporary engine operations add no extra removal guard.

Missing desktop executable/script: Edit and relink the target. Missing browser files: reimport matching contents without substituting another release silently. Browser-store failures: Retry discovery, preserving profiles. Existing native/foreign paths on browser: explain unavailability and allow explicit relink. Use the folder name and request explicit entry selection; upstream name/version metadata is irrelevant.

Bundled Stockfish uses an ordinary app-shipped package folder and default profile on both hosts. It loads directly from app files, without an initial copy or managed-storage restore operation. It appears beside imported packages; Create profile/Details use the same views, and desktop Use included Stockfish fills the actual script path. Managed Remove applies only to imported user folders. Settings reset remains settings-only.

The user selected [service-worker package URLs](EngineInstallationReworkPlan.md#stored-script-loading-options) for stored scripts. The first stored-engine launch lazily starts one shared app registration/control operation. Concurrent launches await the same promise and later launches reuse its successful completion; each process retains its own Worker. Installation, profile editing and bundled app-file loading skip that operation. The generic library handles locally stored file URLs and serving without engine concepts; profiles, bundled defaults and removal rules remain application-owned. Engine initialisation remains with the existing client/runtime. Runtime Starting/failure uses the existing engine UI, without a service-worker setting or new setup step. No replacement workflow or separate version policy is introduced by the unique-name requirement. The existing clickable prototype/screenshots predate these confirmed name/no-version/direct-bundled decisions; this update changes the planning specifications only. Implementation remains stopped pending an explicit instruction to resume.

## Game selection, accessibility and ownership

Game/player/analysis selectors use accepted profiles, not raw paths or unsaved Settings drafts. Show profile name, target summary and known target availability. Preserve existing local/unassigned/keep-current choices, duplicate-assignment rules and the four-analysis-engine limit. Confirmation retains the existing assignment and runtime flow, without a new file check. Keep current engine retains copied launch/options even if its source profile changed or disappeared.

At 760px use compact navigation; stack row actions, wrap paths and keep forms/actions within the page width. Support 390px and 200% text scale with normal page scrolling. Focus the profile name on editor open and the picker on import; Back/Cancel returns focus to the launching action. Tab can leave the form for the surrounding page. Only simple modals use ModalDialog/vFocusScope. Progress is polite status and actionable errors use alerts. CSS owns system-theme selection through color-scheme/light-dark() without subscriptions.

`SettingsView.vue` owns the shared route shell, engine overview and Settings draft/footer. EngineProfileView.vue, EnginePackageImportView.vue and EnginePackageDetailsView.vue are route components in src/views, mounted through RouterView. Each owns its page actions and lifecycle. Reuse the confirmation and single-choice selector modals. Production styles remain global through src/assets/main.css/src/assets/styles/settings.css; documentation overrides stay under docs/design.

## Presentation function flows

Each table header names the caller and rows name its direct calls. Navigation goes through the router; no show/close editor operation swaps a Settings panel.

The underscore-prefixed view actions/callbacks are local to their component setup, not exposed component APIs. Framework hooks invoke the loading and navigation callbacks:

| `EngineProfileView setup` |
| --- |
| `onMounted(_load)` |

| `EnginePackageDetailsView setup` |
| --- |
| `onMounted(_load)` |

| `EnginePackageImportView setup` |
| --- |
| `onMounted(_refreshPackages)` |
| `onBeforeRouteLeave(_beforeRouteLeave)` |
| `onBeforeRouteUpdate(_beforeRouteUpdate)` |

| `EnginePackageImportView._refreshPackages()` |
| --- |
| `EnginesStore.refreshPackages()` |
| `EnginesStore.listPackages()` |

The private action marks discovery unavailable before its read and ready only after success. It shares its actual pending action within the view, retains the discovery error on failure and supplies Refresh/Retry. Install remains disabled until the read succeeds; loading the parent overview is not a prerequisite for this route. Name validation then uses the complete loaded list.

SettingsView's mount/category route-update handler explicitly invokes _loadEnginePackages for the engines category. It stays mounted across child routes; no watcher is added.

New profile branch:

| `SettingsView._openEngineEditor()` |
| --- |
| `Router.push({ name: 'engine-profile-new', params: { category: 'engines' } })` |

Edit branch:

| `SettingsView._openEngineEditor(profile)` |
| --- |
| `Router.push({ name: 'engine-profile-edit', params: { category: 'engines', profileId: profile.id } })` |

| `SettingsView._copyEngine(profile)` |
| --- |
| `Router.push({ name: 'engine-profile-copy', params: { category: 'engines', profileId: profile.id } })` |

RouterView mounts EngineProfileView for that route. The new/edit/copy mode and profile id come from the route. It copies the selected Settings draft fields/options locally, without launching an engine.

| `EngineProfileView._load()` |
| --- |
| `SettingsStore.loadSettings()` |
| `EnginesStore.refreshPackages()` |

Read listPackages for stored-file choices and getPackage for an optional folder hint. A direct profile URL must initialise this data itself; it cannot depend on the overview having run first. Package discovery failure offers Retry while keeping the profile form/selected path editable.

| `SettingsView._loadEnginePackages()` |
| --- |
| `EnginesStore.refreshPackages()` |
| `EnginesStore.listPackages()` |

| `SettingsView._refreshPackages()` |
| --- |
| `EnginesStore.refreshPackages()` |

canInstallPackages controls managed import/remove actions; it is a capability, not a storage-health or engine-compatibility check. The [API descriptions](EngineInstallationReworkPlan.md#enginesstore-additions) explain each proposed call's return value, effects and failures.

The proposed engine-facing action is browseEngineFile(startDirectory?: string): Promise<string>. It chooses the executable or entry-script file for a profile and returns its path. The underlying existing platform method remains IStorageAdapter.showOpenDialog(startDirectory?: string): Promise<string>.

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

Copy the returned path into the local entryPath field. Picker cancellation leaves the form unchanged. The terminal API and its existing cancellation contract are documented in [StorageAdapter](LowLevel/Architecture/PlatformAbstraction/StorageAdapter.md).

For a stored package, choose from IEnginePackage.files and update the local field; no picker or engine-selection service runs. ZIP upload remains the separate original-bytes file input. Choosing a target does not infer its interface or save a profile.

| `EngineProfileView._saveEngine()` |
| --- |
| `Router.replace({ name: 'settings', params: { category: 'engines' } })` |

Keep name validation and write the captured record into the Settings draft before navigation. No Apply or runtime call is added.

| `EngineProfileView._cancel()` |
| --- |
| `Router.push({ name: 'settings', params: { category: 'engines' } })` |

Browser Back/Forward instead uses router history. Unmount discards the local form; it does not reset the Settings draft.

| `SettingsView._openPackageImport()` |
| --- |
| `Router.push({ name: 'engine-package-import', params: { category: 'engines' } })` |

| `EnginePackageImportView._chooseArchive(file)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |
| `file.arrayBuffer()` |
| `new Uint8Array(buffer)` |
| `EnginesStore.readArchive({ path: file.name, data }, signal)` |

The view captures original bytes under its owned file action, checking cancellation after file.arrayBuffer settles. The store/service receive IEnginePackageFile, never the DOM File or a document-import token. readArchive returns a decoded review and writes nothing.

| `EnginePackageImportView._install()` |
| --- |
| `EnginePackageImportView._validateEngineName(engineName)` |
| `EnginesStore.installPackage(engineName, archive, signal)` |

The view first requires successful discovery, a decoded archive and no outstanding file/discovery action. Its private helper validates both name format and uniqueness against the loaded list, supplies the name field's error/eligibility and stops submission when invalid or duplicated. The view supplies its validated Engine name separately from the decoded archive and closes its discovery-ready gate while installation runs. installPackage returns the installed packagePath for the success page's Create profile link; it creates no profile or catalogue record. It awaits the file transaction and subsequent discovery; only successful discovery restores eligibility. Distinguish a failed write from failed discovery after the files were saved, and retry discovery without reissuing a committed import.

The included engine is already served from app files and has no import/restore action.

| `EnginePackageImportView._beforeRouteLeave(to, from)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |

| `EnginePackageImportView._beforeRouteUpdate(to, from)` |
| --- |
| `EnginePackageImportView._settleFileAction()` |

_settleFileAction aborts an owned read when still cancellable, then awaits the actual file action. An issued publication is awaited through commit/abort before returning true. Expected read cancellation is treated as settled; observe any failure through its existing owner rather than leaving a rejected cancellation as the navigation result. It does not start replacement work. The view unmounts only after the router allows departure.

| `EnginePackageImportView._createProfile()` |
| --- |
| `Router.push({ name: 'engine-profile-new', params: { category: 'engines' }, query: { packagePath } })` |

Create profile uses the committed folder as a hint. The new routed form chooses its entry/interface separately and does not apply settings automatically.

| `SettingsView._openPackageDetails(packagePath)` |
| --- |
| `Router.push({ name: 'engine-package-details', params: { category: 'engines' }, query: { packagePath } })` |

| `EnginePackageDetailsView._load()` |
| --- |
| `EnginesStore.refreshPackages()` |
| `EnginesStore.getPackage(packagePath)` |

Missing folders remain a view state with a return link. No modal, registration record or engine launch is involved.

| `EnginePackageDetailsView._removePackage()` |
| --- |
| `IModalController.open(ConfirmationModal, confirmationProps)` |

The existing confirm prop receives the private _confirmRemovePackage callback, with dismissibleWhileWorking false. Opening/cancelling the confirmation performs no deletion. The modal awaits confirmed work and displays failures through its existing action handling.

| `EnginePackageDetailsView._confirmRemovePackage(signal)` |
| --- |
| `signal.throwIfAborted()` |
| `EnginesStore.removePackage(packagePath, _readReferences)` |

The view's private _readReferences callback supplies current accepted/draft profiles and open-game assignments when queued removal starts. Removal remains owned until file deletion and discovery refresh settle; no new public cancellation API is added. The [removal flow](EngineInstallationReworkPlan.md#removing-stored-package-files) expands the store/service calls.

Eight browser checks passed for actual RouterView mounting/unmounting, direct new/edit/copy URLs and reload, missing profiles, browser Back/Forward, Settings draft ownership, read cancellation, issued-write settlement, package routes and 390px/200% text layouts. Opening the static HTML file directly at an editor hash URL also passed. Four screenshots were refreshed. No page errors or engine Worker starts occurred. Report: test-results/EngineRouterDesignResults.json. Files and engines remain simulated; application implementation is stopped.

That preview verification predates the 25 October discovery-eligibility correction. Direct import with delayed/failed discovery and Refresh/Retry after a committed write remain acceptance cases in the rework plan; no new preview or application result is claimed here.
