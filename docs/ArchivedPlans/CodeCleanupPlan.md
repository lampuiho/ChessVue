# Code cleanup follow-up and implementation

Requested and implemented on 19 October 2026: remove generation-based async invalidation, restrict watchers, and infer redundant implementation return types. [AGENTS.md](../AGENTS.md#async-work-and-watchers) records the durable rules. The separate [turn-flow/premove proposal](PreMovePlan%28ToDo%29.md) remains independent of this cleanup.

On 23 October the user requested removal of the retained `workspaceRevision` exception as well. The corrected [counter removal plan](../WorkspaceRevisionRemovalPlan.md) removes the raw-game opt-out and publication infrastructure, using the existing reactive collection and a timestamp-only `timestampGame`. It supersedes the decision to keep the counter. The follow-up is implemented; its verification is recorded in the linked plan. The initial cleanup record below remains historical.

Follow-up on 23 October 2026 removes the two remaining watchers. Explicit settings/theme events and the board update lifecycle now own those effects; observers have no audit exceptions.

## Status

| Item | Result | Status |
| --- | --- | --- |
| CLEAN-01 | Inventory and coding rules recorded | Complete |
| CLEAN-02 | Playback counter removed; turn, analysis and publication ownership audited | Complete |
| CLEAN-03 | Route/session, autosave feedback and menu/modal orchestration use explicit actions and lifecycle hooks | Complete |
| CLEAN-04 | Saved selection and modal watchers removed; board input reset uses its update lifecycle; readiness directly derived | Complete |
| CLEAN-05 | Redundant body return annotations removed across application, journeys, tests and tooling | Complete |
| CLEAN-06 | Build-enforced AST audit rejects all observers, invalidation-counter candidates and redundant return annotations | Complete |

The initial inventory based on `77acaa4` plus the IO follow-up found one remaining named async counter (`playbackGeneration`), 12 Vue observer calls, and 445 body return-annotation candidates. It also counted 120 bodyless callable signatures; those were contracts, not removal candidates. These are historical source counts, not defect or test counts. The earlier selected-details watcher-cleanup correction was an intermediate implementation; selection is now explicitly owned without a watcher.

## Async ownership decisions

| Owner | Implementation and retained constraints |
| --- | --- |
| [OperationOwner](../src/utility/async/OperationOwner.ts) | Aborts current work and serialises its settlement before replacement starts. Disposal prevents later starts. Real failures propagate; cancellation settles internally. No generation, timestamp or promise-identity version marker. |
| [Abortable helpers](../src/utility/async/Abortable.ts) | Playback cancellation clears its actual timeout. Uncancellable file reads stop delivery immediately while their eventual success/rejection is still handled. |
| [GameView](../src/views/GameView.vue) | Owns playback through `OperationOwner`; validates the whole PV prefix before its first commit. Route update/leave and unmount cancel playback. Before each move, checks the actual game and rendered path as legality/context constraints. Old cleanup completes before another playback can own its UI state. |
| [GamePlayerTurnComposable](../src/state/game/GamePlayerTurnComposable.ts) | Rejects duplicate private turn creation and uses the existing abort-and-drain path before replacement. Engine delivery checks its actual abort signal. Removed the pending-promise equality guard. Existing deferred-move validation and pause ownership are preserved; this does not implement premoves. |
| [GameAnalysisComposable](../src/state/game/GameAnalysisComposable.ts), [EngineRuntimeService](../src/domain/EngineRuntimeService.ts) | Retain actual seat/subscription ownership, abort controllers, serialised client work and UCI stop draining. Callback equality protects the callback registration being detached; it is not a numeric stale-result marker. Independent engine resources remain independent. |
| [SavedGamesView](../src/views/SavedGamesView.vue) | Selection, route activation and refresh explicitly resolve a valid snapshot and start owned details delivery. Replacement/unmount cancels it, including selection away from and back to the same snapshot. Late success/error cannot overwrite current details. |
| [ModalComposable](../src/composables/ModalComposable.ts), [modal design](ModalComponentDesign.md) | Each opening mounts its actual component with a fresh local form and abort controller. Dismissal/replacement unmounts that owner and settles its captured completion once. App disposal aborts delivery and suppresses unstarted completions. Late errors, closes and create-navigation cannot affect a replacement. Already-started domain mutations retain their own completion semantics. |
| [FocusScope](../src/directives/FocusScope.ts), added for [JRN-UX](../journeys/definitions/usability/ScenarioReview.md) on 20 October | Each rendered dialog/promotion surface and mobile navigation modal owns its focus containment listeners through directive mount/unmount. A stack of actual mounted owners handles nested focus and restores surviving launchers. Chained modal components remount at their activation boundary. Successful overwrite closes after its action settles, so the launcher is enabled before focus returns. No observer, timer or async invalidation mechanism is used. |
| [NavigationFrame](../src/components/NavigationFrame.vue) | Owns its mobile drawer through explicit open, selection and dismissal actions. The drawer mounts as `NavigationMenuModal` through `useModal`; its unmount disposes focus listeners, and the frame closes its captured handle on unmount. `UiStateStore` owns only the transient shared desktop expansion preference. CSS flex and container sizing own navigation/board placement, without observers, DOM measurements or offset synchronisation. |
| [GamesStore](../../src/state/GamesStore.ts) | The historical counter-retention exception is retired by the [23 October removal](../WorkspaceRevisionRemovalPlan.md). Canonical game data in the existing reactive collection drives rendering. `_timestampGame` records metadata only; no publisher or replacement counter exists. |
| Platform and journey IDs | Retain IDs naming actual registrations, process/search handles and diagnostic/storage records. Schema versions, move sequences and loop indexes also retain their ordinary meanings. |

## Watcher disposition

All Vue observer calls have been removed. Effects run at their explicit action, event, route or component lifecycle boundary.

| Initial site | Final owner |
| --- | --- |
| App appearance `watchEffect` | App applies initial appearance during setup and after startup settings load. `SettingsView` emits `appearanceChanged` after successful Apply, Save or Reset; App handles that routed component event to update document CSS/meta. CSS `color-scheme` and `light-dark()` handle host-theme changes. App and SettingsStore neither query nor subscribe to the system theme; the projection exposes the accepted policy and both palettes. Draft edits and failed writes emit nothing. |
| App session route watcher | Router `afterEach` owns checkpoints for successful committed path changes; duplicate/query-only navigation is ignored. Startup owns its initial checkpoint. Hook is disposed with the app scope. |
| GameView game-ID watcher | Shared activation action called on mount and by `onBeforeRouteUpdate`; validates destination and completes its Menu pause. |
| GameView autosave-error watcher | Autosave failure action emits an explicit notification; the mounted view registers one consumer and disposes it on unmount. |
| GameView modal-kind watcher | Custom-game activation supplies an exactly-once close callback. It resumes its interrupted game if still displayed; returning to that game completes the Menu pause through activation. |
| SavedGamesView group fallback watcher | Refresh/activation actions resolve the current entry or latest valid fallback. |
| SavedGamesView selected-entry watcher | Selection and refresh actions start/cancel owned details delivery. |
| SavedGamesView route watcher | Successful saved-route commit clears overwrite intent and explicitly initialises/resolves selection; hook is disposed on unmount. |
| Removed host form watcher | `useModal().open` mounts a fresh component on every opening, including the same component/props. |
| Chessboard position and board-edit watchers | `onBeforeUpdate` compares the actual position, board-edit and input-disabled props with the current input context, then clears selection/drag/promotion before rendering a changed context. Selection renders and presentation-only updates retain input. `onBeforeUnmount` closes any pending promotion. |
| StartJourney readiness watcher | Read-only computed projection exposed through the journey API's `ready` getter; `stopReady` preserves explicit test teardown. |

The observer exceptions in [CodeAuditPolicy.json](../scripts/CodeAuditPolicy.json) are empty, and the audit rejects observer calls even if an allowance is added. Do not substitute polling, computed side effects or unrelated subscriptions for removed observers.

## Return inference and enforcement

After the ownership refactors, a TypeScript AST edit removed **440** redundant `void`/`Promise<void>` body return annotations across **90 files**. It selected function implementations, methods, arrows and callbacks rather than replacing text. Application, domain, stores, browser/NW.js adapters, UCI, journey tooling and test helpers now infer those returns. Type checking verifies the resulting call boundaries.

Bodyless interfaces/overloads and callable properties remain typed. Promise/Deferred generics, fields, `void` operators, meaningful result annotations and type predicates remain intact. The current audit has no implementation-return exceptions. Root configuration and audit tooling are included in ongoing inspection.

`npm run check:code` executes [CodeAudit.mjs](../scripts/CodeAudit.mjs) during `npm run build`. Its [syntax inspector](../scripts/audit/InspectSource.mjs) checks Vue scripts, TypeScript and tooling for:

- All watcher/effect calls, including imported aliases, Vue namespaces/bracket calls and direct `$watch`/Pinia `$subscribe` forms.
- Generation/epoch/version-token candidates and mutable counters captured and compared around async work, including a renamed serial.
- Implementation `void`/`Promise<void>` returns, separately from callable declarations and promise generics.
- Duplicated allowed calls, missing justifications and stale policy entries.

These checks identify syntax candidates; they do not prove arbitrary async code correct or replace ownership review. Actual resource IDs are retained by purpose. New aliases, identity guards and subscription forms still need semantic review.

## Verification

The CSS system-theme follow-up on 23 October 2026 passes **14/14 focused unit/application tests** and **16/16 browser tests**. App and SettingsStore make no system-theme query or subscription during startup, settings actions, navigation or disposal. Browser theme-policy tests make `matchMedia` throw while exercising system, forced light and forced dark modes, then check rendered colours and persisted settings. Apply, Save, Reset, rejected writes and reload/new-page restoration pass. `npm run build` passes the code audit, all TypeScript projects and production bundling. The browser report is `test-results/CssSystemThemeBrowserResults.json` (ports 5173/5174, one worker, no retries). Earlier watcher-removal verification below predates this CSS ownership follow-up.

Watcher-removal follow-up on 23 October 2026 passes **78/78 focused unit/application tests across five files**. Coverage includes SettingsView Apply/Save/Reset events, failed persistence and disposal during an in-flight UI action; SettingsStore; Chessboard input ownership; GameView; and audit syntax. `npm run build` passes the code audit, all TypeScript projects and production bundling. The final browser rerun passes **7/7 appearance and scale tests**, using ports 5073/5074, one worker and no retries, with no skips or flaky results. The earlier 23-case browser run covers promotion cancellation and gestures alongside appearance and scale. Reports are `test-results/WatcherRemovalUnitResults.json`, `test-results/WatcherRemovalAppearanceBrowserResults.json` and `test-results/WatcherRemovalBrowserResults.json`. These focused checks supplement the historical cleanup verification below.

Verification completed on 19 October 2026: **527 unit/application tests and 155 focused browser tests passed**. Reports are generated under ignored `test-results/`; source counts and discovery are not execution evidence. Earlier IO acceptance is recorded separately in [JourneyImplementation.md](JourneyImplementation.md#storage-failure-verification).

The broad browser regression run passed **128/128 tests**, with no errors, skips, failures, retries or flaky results and normal worker/server cleanup, in `test-results/CleanupBrowserResults.json`. It starts at `2026-10-19T14:34:08.123Z`, uses ports 4873/4874, one worker, a 180-second outer timeout and no retries, and took 569.67 seconds. It covers both projects: IO, Analysis, engine races, clock Menu ownership, Saves Load/ManagedSave/Deletion, Settings Appearance/Navigation and Fresh/Promotion cancellation. This run preceded the final drag reset correction, which has its own focused coverage.

Three new [board-component checks](../src/components/__tests__/Chessboard.spec.ts) cover external position/mode changes during a drag and pending-promotion replacement. With raw board fixtures matching GameView, the two drag cases first reproduced stale `chessPieceMoved` delivery; `clearSelection` now also clears its drag origin. All three pass in the final full unit run.

After the board fix, **27/27 additional browser tests** passed with no errors, skips, failures, retries or flaky results and normal cleanup in `test-results/CleanupBoardBrowserResults.json`. This run starts at `2026-10-19T19:15:05.593Z`, uses ports 4973/4974, one worker, a 180-second outer timeout and no retries, and took 233.44 seconds. Its exact scope is Promotion `Gesture.spec.ts` and Setup `BoardEdit.spec.ts`, `Palette.spec.ts`, `Reset.spec.ts`: both colours/orientations, quiet/capture promotion, all palette pieces, history preservation, clear/reset and analysis restart. Together the two browser runs execute 155 distinct cases.

The final complete unit and mounted application suite passed **527/527 tests across 84 files**, with no unhandled errors, in `test-results/CleanupFinalUnitResults.json`, starting at `2026-10-19T19:12:59.178Z`. It ran portable Node with `vitest run --maxWorkers=1 --pool=threads --testTimeout=90000` and took 110.72 seconds. This includes all 13 audit syntax regressions, four operation-owner cases, nine UI-store checks, four mounted route/dialog checks and three board-context checks. `npm run build` passed the code audit, application/unit/end-to-end TypeScript projects and production bundling. The code audit passed again after the final boundary comment/policy clarification. A read-only AST comparison against Git confirmed that all **81** previously existing code files changed outside the reviewed behaviour/test sites contain only the intended body-return annotation removals.

- Ownership tests cover cleared timers, cancellation settlement before replacement, late uncancellable success/error, real failure recovery and disposal.
- Mounted application tests cover exactly-once route checkpoints/back navigation, repeated dialog close, same-kind activation, stale dialog success/error/navigation and same-snapshot details success/error.
- The full unit suite covers existing store/turn/runtime/UCI behaviour, all journey bootstraps and the audit's alias/counter/contract regressions.
- Relevant browser acceptance covers IO, analysis, engine races, Menu pauses, saves, appearance/navigation and creation/promotion cancellation. Mounted application tests run separately from browsers, with one browser worker and no retries on this host.
- The code audit, all TypeScript projects, production build, all 108 local links in 17 changed Markdown documents, and `git diff HEAD --check` pass. No whole-browser-catalogue or native NW.js runtime acceptance is claimed.

## Global styling boundary

The styling follow-up uses [one global entry](../src/assets/main.css) and [purpose-specific modules](../src/assets/styles/README.md). Shared navigation, controls and side-panel styles are declared once; explicit class variants distinguish compact actions, player/analysis errors and route presentation. Vue files have no style blocks or scope escapes. Their remaining style bindings provide history-depth and theme-preview custom-property values rather than CSS declarations. Gameplay, persistence and focus ownership remain at their existing action/lifecycle boundaries.

[InspectStyles](../scripts/audit/InspectStyles.mjs) extends `npm run check:code` to reject Vue style blocks and CSS scope-escape selectors. It parses actual Vue style blocks, including external styles, and ignores normal template/script text. [Audit tests](../scripts/__tests__/StyleAudit.spec.ts) cover the forbidden forms and permitted global rules/runtime values. Visual and route regressions verify viewport fit, intrinsic menu sizing, dialogs and stable appearance across route changes.
