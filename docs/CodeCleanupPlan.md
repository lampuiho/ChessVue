# Code cleanup follow-up and implementation

Requested and implemented on 19 October 2026: remove generation-based async invalidation, restrict watchers, and infer redundant implementation return types. [AGENTS.md](../AGENTS.md#async-work-and-watchers) records the durable rules. The separate [turn-flow/premove proposal](PreMovePlan%28ToDo%29.md) remains independent of this cleanup.

## Status

| Item | Result | Status |
| --- | --- | --- |
| CLEAN-01 | Inventory and coding rules recorded | Complete |
| CLEAN-02 | Playback counter removed; turn, analysis and publication ownership audited | Complete |
| CLEAN-03 | Route/session, autosave feedback and menu/modal orchestration use explicit actions and lifecycle hooks | Complete |
| CLEAN-04 | Saved selection and modal watchers removed; board observers consolidated; readiness directly derived | Complete |
| CLEAN-05 | Redundant body return annotations removed across application, journeys, tests and tooling | Complete |
| CLEAN-06 | Build-enforced AST audit rejects unlisted observers, invalidation-counter candidates and redundant return annotations | Complete |

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
| [UiStateStore](../src/state/UiStateStore.ts), [ModalHost](../src/components/ModalHost.vue) | Dialog activation creates fresh form state and an abort controller. Dismissal/replacement aborts delivery and invokes the captured completion once. Store disposal aborts delivery. Pending actions retain their own form; their late error, close or create-navigation cannot affect a replacement dialog. Already-started domain mutations retain their own completion semantics. |
| [FocusScope](../src/components/common/FocusScope.ts), added for [JRN-UX](../journeys/definitions/usability/ScenarioReview.md) on 20 October | Each rendered dialog/promotion surface and mobile navigation drawer owns its focus containment listeners through directive mount/unmount. A stack of actual mounted owners handles nested focus and restores surviving launchers. Chained modal kinds remount at their activation boundary. Successful overwrite closes after its action settles, so the launcher is enabled before focus returns. No observer, timer or async invalidation mechanism is used. |
| [NavigationFrame](../src/components/NavigationFrame.vue) | Owns its mobile drawer through explicit open, selection and dismissal actions. The rendered drawer uses `FocusScope`; unmount disposes its listeners. `UiStateStore` owns only the transient shared desktop expansion preference. CSS flex and container sizing own navigation/board placement, without observers, DOM measurements or offset synchronisation. |
| [GamesStore](../src/state/GamesStore.ts), `workspaceRevision` | Retained as the publication count for deliberately raw canonical games, incremented at `touchGame`. Readers are GameView projections, HistoryPanel tree projection and journey readiness. This is an explicit rendering publication boundary, not a counter captured to reject async completion. Replacing it would require changing the raw-game reactivity contract. |
| Platform and journey IDs | Retain IDs naming actual registrations, process/search handles and diagnostic/storage records. Schema versions, move sequences and loop indexes also retain their ordinary meanings. |

## Watcher disposition

Ten observer calls were removed or consolidated: only two synchronous Vue boundary watchers remain. No watcher performs gameplay, engine, persistence, modal-completion or details-I/O orchestration.

| Initial site | Final owner |
| --- | --- |
| App appearance `watchEffect` | Narrow `watch` on appearance projection, accepted appearance and resolved host theme. Its synchronous callback runs immediately and in Vue's normal pre-render batch. Output is document CSS/meta tags only. |
| App session route watcher | Router `afterEach` owns checkpoints for successful committed path changes; duplicate/query-only navigation is ignored. Startup owns its initial checkpoint. Hook is disposed with the app scope. |
| GameView game-ID watcher | Shared activation action called on mount and by `onBeforeRouteUpdate`; validates destination and completes its Menu pause. |
| GameView autosave-error watcher | Autosave failure action emits an explicit notification; the mounted view registers one consumer and disposes it on unmount. |
| GameView modal-kind watcher | Custom-game activation supplies an exactly-once close callback. It resumes its interrupted game if still displayed; returning to that game completes the Menu pause through activation. |
| SavedGamesView group fallback watcher | Refresh/activation actions resolve the current entry or latest valid fallback. |
| SavedGamesView selected-entry watcher | Selection and refresh actions start/cancel owned details delivery. |
| SavedGamesView route watcher | Successful saved-route commit clears overwrite intent and explicitly initialises/resolves selection; hook is disposed on unmount. |
| ModalHost form watcher | `UiStateStore.showModal` creates a fresh form on every activation, including the same kind/payload. |
| Chessboard position and board-edit watchers | One synchronous observer of these two external props clears transient selection/drag/promotion. Moves can originate from engines, history or another route outside the board's input actions. |
| StartJourney readiness watcher | Read-only computed projection exposed through the journey API's `ready` getter; `stopReady` preserves explicit test teardown. |

The App and Chessboard comments state the external boundary and output. Vue disposes both watchers with their component scopes. Their exact inputs and reasons are the only observer exceptions in [CodeAuditPolicy.json](../scripts/CodeAuditPolicy.json). Adding another watcher requires a specific boundary justification and policy review; existing use is not precedent. Do not substitute polling, computed side effects or unrelated subscriptions for removed observers.

## Return inference and enforcement

After the ownership refactors, a TypeScript AST edit removed **440** redundant `void`/`Promise<void>` body return annotations across **90 files**. It selected function implementations, methods, arrows and callbacks rather than replacing text. Application, domain, stores, browser/NW.js adapters, UCI, journey tooling and test helpers now infer those returns. Type checking verifies the resulting call boundaries.

Bodyless interfaces/overloads and callable properties remain typed. Promise/Deferred generics, fields, `void` operators, meaningful result annotations and type predicates remain intact. The current audit has no implementation-return exceptions. Root configuration and audit tooling are included in ongoing inspection.

`npm run check:code` executes [CodeAudit.mjs](../scripts/CodeAudit.mjs) during `npm run build`. Its [syntax inspector](../scripts/audit/InspectSource.mjs) checks Vue scripts, TypeScript and tooling for:

- Unlisted watcher/effect calls, including imported aliases, Vue namespaces/bracket calls and direct `$watch`/Pinia `$subscribe` forms.
- Generation/epoch/version-token candidates and mutable counters captured and compared around async work, including a renamed serial.
- Implementation `void`/`Promise<void>` returns, separately from callable declarations and promise generics.
- Duplicated allowed calls, missing justifications and stale policy entries.

These checks identify syntax candidates; they do not prove arbitrary async code correct or replace ownership review. Actual resource IDs are retained by purpose. New aliases, identity guards and subscription forms still need semantic review.

## Verification

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
