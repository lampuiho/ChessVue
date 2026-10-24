# Engine management UI design

Proposed on 23 October 2026; revised on 24 October 2026 for the [engine target and package rework](EngineInstallationReworkPlan.md). Status: design. The [clickable prototype](design/EngineManagement.html) uses sample data and simulated file selection, package reads and imports. It changes no application settings or engine files.

Open the HTML file in a browser. Preview controls switch desktop/browser host, ready/missing/empty/incompatible states and light/dark/system appearance. Those controls belong to the documentation artifact, not the product.

Rendered previews: [desktop Settings](design/EngineManagementDesktop.png), [desktop package profile](design/EngineManagementPackage.png), [browser import](design/EngineManagementInstall.png), [narrow profile editor](design/EngineManagementMobile.png), [browser removal](design/EngineManagementRemoval.png), [browser analysis selector](design/EngineManagementSelection.png) and [dark desktop](design/EngineManagementDark.png).

## Host-specific Settings

Desktop has Engine profiles followed by Analysis behaviour. There is no installed-engine catalogue or Install engine action. Add profile points at an executable or package folder directly. Existing profile rows show a name, target summary, options and Copy/Edit/Delete. The bundled Stockfish profile is an ordinary package profile.

Browser adds Installed browser engines above those sections. That list comes from reading `engine.json` in each stored package folder through `EnginePackageService.listBrowserPackages()`, owned by `EnginesStore.loadBrowserPackages()`. No persisted catalogue or installation records are read. Refresh explicitly repeats discovery while keeping profile edits; failed discovery shows Retry rather than an empty-list success state.

```text
DESKTOP / Settings / Engines

Engine profiles                                      [+ Add profile]
Names, executable or package paths, and options for games.

Stockfish                                    [Copy] [Edit] [Delete]
Browser package / Included with ChessVue
Default engine options

My desktop engine                            [Copy] [Edit] [Delete]
Desktop executable / C:\Engines\engine.exe
Hash 128

Analysis behaviour
[x] Resume assigned analysis engines after restore

All profile changes saved                    [Cancel] [Save] [Apply]
```

```text
BROWSER / Settings / Engines

Installed browser engines                    [+ Install browser engine]
Packages stored in this browser. Imports take effect immediately.

Stockfish [Included with ChessVue] [Ready]
19.0.1 / Computer play and analysis
                                [Create profile] [Details] [Remove]

Engine profiles                                      [+ Add profile]
...saved configurations, including unavailable desktop profiles...

Analysis behaviour
...
```

Reuse the current Settings navigation, warm light/slate dark palettes, serif headings, shared fields/buttons and restrained state badges. Do not create another settings category or an engine dashboard. The prototype uses visible text row actions for review; production may retain existing Copy/Edit/Delete icon controls with accessible names and tooltips.

## Desktop profile form

```text
Add engine profile                                               [x]
Choose an executable or a browser engine package folder.

Profile name
[My engine                                                     ]

Engine target
[Desktop executable v]       alternatives: Browser package

Executable path
[C:\Engines\engine.exe                             ] [Browse]
The executable stays in its current location.

Options                                            [+ Add option]
[Hash                         ] [128                    ] [Remove]

Apply or Save on Settings to keep this profile.
                                               [Cancel] [Add profile]
```

Browser package replaces the executable field with Package folder, Browse folder and Use included Stockfish. Selecting or checking the folder reads its `engine.json` and displays engine name/version and readiness or a specific error. Do not ask users to choose StockfishJs, UciWorker or another implementation: the package manifest declares the supported client. Both forms retain a path field that the user can type or paste.

```text
Engine target
[Browser package v]

Package folder
[D:\Chess\Engines\training-engine                   ] [Browse folder]
[Use included Stockfish]

Training engine / 1.0 [Ready]
Metadata read from this folder. Files stay in their current location.
```

A package is an unpacked folder containing `engine.json`, the unified `worker.js` entry and its assets. If a user has a ZIP on desktop, helper text says to extract it and choose the resulting folder. Adding a profile never copies, installs or registers that folder. Choosing the bundled package fills its normal app-relative package path; it follows the same metadata-read and runtime paths.

Selecting a new target cancels/settles the old target check before reading/probing the replacement. Browse cancellation leaves the form unchanged. Checking/reading changes only the local form. Editing a profile preserves its options until the user changes them; incompatible option metadata is explained rather than silently discarded. Require a nonempty unique name and a usable target for new profiles. Preserve existing unavailable targets for repair without substituting another engine.

Copy creates a uniquely named local copy of target/options. Update/Add returns to the Settings draft. Deleting a profile removes only that draft configuration. Apply/Save persists profile changes; none of these actions deletes a desktop executable or folder. Existing games retain their copied target/options.

The current Protocol row is removed. Keep `EngineClientType` as the only persisted implementation discriminator; target-category UI introduces no second enum.

## Browser profile form and import

Browser profile creation chooses an Installed browser engine from the manifest-derived list, then edits name/options. Several profiles may share a package. With no packages, show Install a browser engine first and a direct action into import; desktop does not have this prerequisite.

Existing desktop executable paths and external desktop package paths remain readable on browser, with Available in the desktop app or Package folder is not available in this browser. They stay in settings and saved games. Relink explicitly chooses an available package and explains that it changes this profile, not existing assignments. Unsupported or missing targets never auto-select another package.

Install browser engine opens a package ZIP picker, review, check and result flow. There is no Desktop executable tab or native registration step.

| State | Content and actions |
| --- | --- |
| No file | Choose package; disabled Install engine |
| Selected | File name, manifest engine/version, compatibility; Choose another package and Install engine |
| Reading/checking | Reading files, then Checking engine compatibility; Cancel allowed; no invented percentage |
| Publication | Finishing installation; close/Escape/backdrop disabled until publication settles |
| Success | Engine installed, verified roles; Done or Create profile |
| Duplicate | Already installed; reuse existing package folder, no duplicate metadata row |
| Failure | Stage-specific error, Retry or Choose another package; no partially listed package |

Create profile replaces the result dialog with an editor seeded from the stored package folder. It does not create or apply a profile automatically. Done leaves the package imported with no new profile. Cancelling a running check publishes nothing. Once the storage transaction starts, settle it before reporting success/failure.

Bundled/imported packages have the same format, loader and row presentation. Included with ChessVue is provenance from `EngineInstallationSource.Bundled`, not a runtime implementation. Browser Restore included engine imports the supplied standard package if missing. Desktop Use included Stockfish only chooses its app-supplied folder; desktop has nothing to restore through an importer.

## Draft and storage boundaries

| Action | Profiles/behaviour | Engine files |
| --- | --- | --- |
| Desktop Browse/check target | Local form only | Read only, no install or copy |
| Add/Update/Copy/Delete profile | Settings draft only | No filesystem change |
| Apply | Persist draft, remain on Settings | No desktop file change |
| Save | Persist draft, leave via existing Settings flow | No desktop file change |
| Cancel/discard | Restore accepted profile/behaviour settings | Completed browser imports remain |
| Browser import/remove/restore | Do not apply profile draft | Immediate atomic package storage operation |

Dirty-leave message: Your profile and behaviour changes have not been applied. Completed browser engine installations will remain installed. Preserve the draft if validation or persistence fails, and explain the unavailable target. Closing a local form discards only that form.

## Browser details, removal and recovery

These package management actions exist on browser only. Details shows manifest name/version, Included with ChessVue or Imported package provenance, verified roles, availability and saved/draft/open-game references. Source is an enum in contracts, rendered as user-facing text. Do not put client enum values, digests or vendor filenames in normal rows.

Remove first gathers saved profiles, current draft profiles, open-game assignments and resource leases referring to that virtual package folder. If referenced, show Engine is still in use, the names/reasons and Close/Show profiles. A profile deleted only in the draft still blocks removal until Apply/Save. A newly discovered reference or lease blocks publication of the deletion. Do not delete profiles or change game assignments automatically.

If unused, confirm Remove engine? with Keep engine and Remove engine. Explain that browser-stored package files will be removed and closed games may need the same package imported again. Deleting a desktop profile has no equivalent package-removal dialog because its files remain user-managed.

| State | Recovery |
| --- | --- |
| Desktop executable missing | Edit profile and choose its new path |
| Desktop package missing/unreadable | Edit profile and choose/check the folder; preserve original path/options |
| Package lacks `engine.json` or entry/assets | Explain the missing item; choose a valid package folder or ZIP |
| Browser package files missing/corrupt | Reimport matching package into the same target where safe; do not silently substitute another release |
| Browser package store read failed | Retry discovery; preserve profiles and show errors separately from an empty list |
| Bundled browser package removed | Restore included engine via normal importer |
| Browser sees native/foreign desktop path | Show unavailable reason and explicit relink; preserve the saved target |
| Unknown client interface | Explain unsupported interface/version and keep repair available |

Default settings reset restores default profiles and ensures the bundled package resolves. Browser reset retains unrelated imported packages. Desktop reset neither deletes external files nor copies packages.

## Game selection

New-game, player and analysis selectors choose accepted profiles, never raw paths or unsaved Settings drafts. Show the profile name, executable/package summary and requested-role availability. Keep unavailable choices visible and disabled, with their reasons associated using `aria-describedby`.

Preserve Unassigned, Local player and Keep current engine choices where applicable. Keep current engine retains an assignment's copied configuration even if its source profile changed or disappeared. Preserve duplicate-assignment rules and the four-analysis-engine limit. Analysis availability requires working active-search interruption, not merely worker messaging.

With no saved profiles, explain Create a profile in Settings and Apply your changes first. Keep the existing game/modal leave and pause semantics. Revalidate the selected target at confirmation; a disappeared target keeps the chooser open with an actionable error, rather than silently choosing another profile.

## Responsive layout, accessibility and ownership

At 760px use the existing compact navigation. Stack row metadata/actions and wrap paths. Keep footer actions reachable while content scrolls; dialogs fit the viewport with scrollable contents. Support 390px width and 200% text scale without horizontal scrolling.

Use text alongside state colours. Focus the profile name on editor open and package picker on import. Production uses the existing `ModalDialog`/`vFocusScope` ownership: Tab stays inside, Escape follows operation policy, and close restores the surviving launcher or section heading. Progress is polite status; actionable failures are alerts. Move focus for submission errors, not background checks. CSS owns system-theme selection through `color-scheme` and `light-dark()`; no OS-theme subscription.

| Surface | Proposed owner |
| --- | --- |
| Host-specific sections, draft/footer feedback | `SettingsView.vue` and meaningful extracted `.vue` sections |
| Executable/package path or browser-package form | Existing `EngineProfileModal.vue`, owned target checks through services |
| Browser import/review/check/result | `EngineInstallationModal.vue`, browser-only package actions |
| Browser package metadata/references | `EngineInstallationDetailsModal.vue`, shared confirmation for unused removal |
| Role-aware game selectors | Existing `GameCreationModal.vue`, `PlayerSelectionModal.vue`, `AnalysisEngineSelectionModal.vue` |
| Production styles | Shared global controls and `src/assets/styles/settings.css` via `src/assets/main.css` |

Prototype layout/theme overrides live only under `docs/design`, using the app stylesheet. Its picker, metadata and import checks are simulations; screenshots do not establish actual package loading or runtime acceptance.

Reviewed on 24 October 2026: 20 checks passed for the revised prototype, including direct executable/package folder profiles without desktop installation, browser import/removal and recovery, Apply/Cancel boundaries, native unavailability on browser, duplicate-name feedback, focus containment/restoration, 390px layout, 200% text scale, dark appearance and rendered symbols. No browser script errors were recorded. Seven screenshots were regenerated. The generated report is `test-results/EngineManagementDesignResults.json`; it replaces the earlier catalogue-based prototype results. JavaScript syntax, local documentation links and `npm run check:code` also passed.
