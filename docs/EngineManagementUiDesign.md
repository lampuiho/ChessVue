# Engine management UI design

Proposed on 23 October 2026; revised on 24 October 2026 for the [engine rework](EngineInstallationReworkPlan.md). Status: design. The [clickable prototype](design/EngineManagement.html) uses sample data and simulated file picking, package reads and imports. It does not implement real engine loading.

Open the HTML file in a browser. Documentation-only preview controls select desktop/browser, ready/missing/empty/incompatible states and light/dark/system appearance.

Previews: [desktop Settings](design/EngineManagementDesktop.png), [desktop browser-engine profile](design/EngineManagementPackage.png), [browser import](design/EngineManagementInstall.png), [narrow editor](design/EngineManagementMobile.png), [browser removal](design/EngineManagementRemoval.png), [browser analysis selector](design/EngineManagementSelection.png), [dark desktop](design/EngineManagementDark.png).

## Settings by host

Desktop shows Engine profiles and Analysis behaviour. Profiles point to executables or the actual entry files inside browser engine packages. There is no desktop installed-engine catalogue, registration or Install engine action. Browse package can expose its entry candidates; the user selects the intended script and supported interface.

Browser adds Installed browser engines above those sections. `EnginesStore.loadBrowserPackages()` owns folder discovery through `EnginePackageService`. Read existing `package.json` name/version where present, otherwise display the folder name. Do not require or generate loading manifests, catalogue rows or remembered-entry metadata. A folder's presence does not prove which script/interface/roles it supports.

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

Browser package rows show package/folder name, existing version if available, Included with ChessVue or Imported package source, file availability and Create profile/Details/Remove. Show script candidates when choosing a target; do not imply that every file is an executable engine. Refresh preserves profile edits; discovery errors show Retry rather than an empty-list success.

Reuse the Settings shell, current palettes, serif headings, shared fields/buttons and accessible Copy/Edit/Delete controls. Source is an enum in contracts, rendered as user-facing text. No client enum values, digests or invented package versions in ordinary rows.

## Desktop profile form

```text
Add engine profile                                               [x]
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

There is no prescribed entry filename or app-specific manifest. Stockfish, Lozza and tomitankChess keep their supplied names. Browse can start from a package folder and list actual candidates. Existing metadata may suggest a compatible entry where supported; an npm `main` may be a Node wrapper and must not silently become a Worker target. If multiple builds or helper files exist, ask the user which entry to run. An unsupported module API needs another implemented client, not a rename.

Save the selected entry path, `EngineClientType`, name and options in the profile. This is launch configuration, not an installation record. No extra implementation/protocol enum is introduced. For the initial clients, labels map to Uci and UciWorker; future supported interfaces add values to that same selector. Remove the current Protocol row.

Use included Stockfish fills the actual supplied script path. Adding/checking a target neither copies files nor writes metadata into its folder. ZIP users on desktop extract their package wherever they choose, then select its entry. Existing relative assets remain in their supplied layout.

Target changes cancel/settle the old check before a replacement starts. Browse cancellation leaves the form intact. Read/probe at an explicit action boundary through the selected client; show engine identity/options or a specific failure. Require a unique nonempty profile name and a usable target for new profiles. Preserve existing unavailable targets for repair without substituting another engine or discarding configured options silently.

Copy creates a local target/options copy with a unique name. Add/Update returns to the Settings draft. Delete removes that draft configuration only. Apply/Save persists profile changes; executable/package files remain user-managed and open games retain their copied configuration.

## Browser profile form

Choose Engine entry script from actual files grouped by imported package. Keep the supported interface selector explicit. A package may have several engine builds and helper scripts, so the folder alone is not a launch target. Show a blank Choose the engine entry script choice when no selection was provided. Do not choose the first JavaScript file automatically.

Several profiles may target one entry with different options, or different entries in one package. Existing native/external-desktop paths remain visible on browser with their unavailable reason and explicit relink. Changing a profile does not rewrite existing game assignments.

No stored packages: Install a browser engine first opens import. Desktop has no such prerequisite. A browser import's captured choice may seed Create profile directly on success, but Done stores no remembered default entry. Returning later to create a profile asks the user again if the existing files do not identify the entry unambiguously.

## Browser import

Install browser engine opens a ZIP picker and review. There is no Desktop executable installation tab. Preserve all original package paths and files; create no new loading manifest or catalogue record.

```text
Install browser engine                                           [x]
Package imports take effect immediately. Profiles are saved separately.

Choose an engine archive                         [Choose package]

Selected file    training-engine.zip
Package          training-engine        folder name fallback
Version          Not supplied          when metadata is absent
Interface        Browser UCI Worker

Entry script to check
[Choose the engine entry script v]
  training-engine.js
  helper.js

Choose the engine entry, rather than a helper script.
No standard filename or new manifest is required.

                                           [Cancel] [Install engine]
```

| State | Content/actions |
| --- | --- |
| No file | Choose package; disabled Install engine |
| File selected | Existing metadata/folder label and candidate files; require an explicit valid entry/interface choice before checking |
| Reading/checking | Read package files, check selected target and requested role; Cancel allowed, no invented percentage |
| Publication | Save the original package files atomically; disable close/Escape/backdrop until settlement |
| Success | Import complete; show checked entry, Done or Create profile |
| Failure | Specific file/interface/asset/lifecycle error, Retry or another selection; no partially listed folder |

The user chooses the engine entry; helpers and incompatible module APIs fail the real client probe. Passing message transport alone does not enable infinite analysis, pondering or other roles. The prototype simulates that probe and cannot establish compatibility.

Create profile replaces the success dialog and uses the action's captured entry selection. It does not automatically create/apply a profile. Done may leave a package with no profiles and no saved entry choice. A later profile stores its chosen virtual script path. Existing package metadata is read where present, not manufactured.

## Draft and storage boundaries

| Action | Profiles/settings | Engine files |
| --- | --- | --- |
| Desktop select/check target | Local form only | Read only, no installation or metadata write |
| Add/Update/Copy/Delete profile | Settings draft | No change |
| Apply/Save | Persist draft; Save leaves via existing Settings flow | No desktop file changes |
| Cancel/discard | Restore accepted profile/behaviour settings | Completed browser imports remain |
| Browser import/remove/restore | Do not apply profile draft | Immediate package-file operation |

Dirty-leave copy explains that profile changes have not been applied and completed browser imports remain installed. Validation/persistence failures keep the draft open with a repair action. Closing the local form discards only that form.

## Browser details, removal and recovery

Details displays existing package metadata/folder name, source, files and referencing profiles/games. Unknown version/roles remain unknown until the selected build is checked. Do not label an entire archive analysis-compatible because one entry was probed during an earlier import.

Removal checks accepted/draft profile entries, open-game assignments and active leases under that virtual package root. A draft-only profile deletion still blocks removal until Apply. Blocked removal names references and offers Close/Show profiles. Unused removal confirms deletion of browser-stored files and explains that closed games may need reimport. Recheck references/leases at deletion; never delete profiles or retarget games automatically. Native profiles are not browser package references.

Missing desktop executable/script: Edit and relink the target. Missing browser files: reimport matching contents without substituting another release silently. Browser-store failures: Retry discovery, preserving profiles. Existing native/foreign paths on browser: explain unavailability and allow explicit relink. Absent package metadata is normal; use the folder name and request entry selection.

Bundled Stockfish consists of the same supplied files used by its ordinary default profile. Desktop's shortcut selects its real entry. Browser Restore reimports those files through the normal pipeline and resets no unrelated profiles. Settings reset restores default profiles, ensures the included entry resolves and retains unrelated browser packages and external desktop files.

## Game selection, accessibility and ownership

Game/player/analysis selectors use accepted profiles, not raw paths or unsaved Settings drafts. Show profile name, target summary and role-specific availability. Preserve existing local/unassigned/keep-current choices, duplicate-assignment rules and the four-analysis-engine limit. Revalidate the chosen entry at confirmation; keep the chooser open on failure. Keep current engine retains copied launch/options even if its source profile changed or disappeared.

At 760px use compact navigation; stack row actions, wrap paths, keep footer actions reachable and fit scrollable dialogs to the viewport. Support 390px and 200% text scale. Pair state colours with text; associate disabled choices with their reasons. Focus the profile name on editor open and the picker on import. Production uses `ModalDialog`/`vFocusScope` for containment and launcher restoration. Progress is polite status; actionable errors use alerts. CSS owns system-theme selection through `color-scheme`/`light-dark()` without subscriptions.

`SettingsView.vue` owns sections/draft/footer; `EngineProfileModal.vue` owns local entry checks; browser-only `EngineInstallationModal.vue` owns import review/check/result. Reuse shared confirmation and existing game selector components. Production styles remain global through `src/assets/main.css`/`src/assets/styles/settings.css`; documentation overrides stay under `docs/design`.

Reviewed on 24 October 2026: 17 checks passed across two review runs for the revised entry-file prototype. Coverage includes direct desktop targets, archives without metadata, explicit entry selection, simulated helper-script rejection, cancellation, profile Apply/Discard, later entry selection without remembered package metadata, reference-aware removal, repair/default restore, unavailable native profiles, keyboard focus, 390px width, 200% text scale and dark appearance. Seven screenshots were refreshed. No browser script errors were observed. The generated `test-results/EngineManagementDesignResults.json` replaces the earlier package-folder prototype results; it is simulation evidence, not actual engine compatibility. JavaScript syntax, documentation links and `npm run check:code` also passed.
