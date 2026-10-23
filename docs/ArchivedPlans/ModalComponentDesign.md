# Modal mounting composable

**Status: implemented and verified, including the remaining-surface correction.** Approved and implemented on 22 October 2026: one composable mounts the supplied modal component. The host/registry proposal and intermediate duplicate-key correction are superseded by removal of the host.

## Model and API

Use one app-scoped `useModal` composable to mount a supplied Vue component. A caller names the component and passes its typed props directly:

```ts
const modal = useModal();
const dialog = modal.open(PlayerSelectionModal, { gameId, colour, currentPlayer });
// Optional explicit dismissal of this particular opening:
await dialog.close();
```

The public shape is `open(component, props, onClosed?) -> { close, signal }`. Infer props from the supplied SFC, excluding the internally supplied `signal` and `onDismissed`. `onClosed` keeps its current `() => void | Promise<void>` completion contract. `close()` is idempotent and returns its close completion. No confirmation-result enum or new promise-based workflow is needed.

- The composable owns the mounted VNode, DOM container, abort controller and close completion for one active modal.
- The modal component owns its local form, busy/error state and feature behaviour. The supplied `signal` governs late UI delivery; `dismissed` requests closing that mounted instance.
- Existing `ModalDialog` supplies the shell/focus behaviour, and `NewGameModal` remains the reusable creation/setup form.
- Callers select components directly. `ModalHost`, its kind dispatch and the proposed component registry are removed.

Share simple confirmation and acknowledgement components with typed props. Wire their specific operations at the calling feature; use dedicated components for forms or distinct behaviour such as player/analysis-engine selection and draw response. Do not create a separate component for every title/message or introduce a framework of dialog definitions.

## Named functions and contracts

These functions live in `src/composables/ModalComposable.ts`. `useModalProvider` is the root initialiser; `useModal` retrieves the provided controller. They share the same closure-owned implementation, not separate managers.

```ts
interface IModalHandle {
  readonly signal: AbortSignal;
  close: () => Promise<void>;
}
interface IModalController {
  open<C extends Component>(
    component: C,
    props: ModalProps<C>,
    onClosed?: () => void | Promise<void>,
  ): IModalHandle;
}
```

`Component` is Vue's component type. `ModalProps<C>` infers the supplied SFC's public `$props` and omits the reserved `signal`/`onDismissed` supplied by the composable. The first implementation supports the imported SFCs used here; do not broaden this into a component-factory library. These are callable contracts; implementation returns stay inferred.

| Function | Inputs / result | Exact responsibility |
| --- | --- | --- |
| `useModalProvider()` | Setup context -> `IModalController` | Capture the existing app context, create the single app-owned closure, publish its controller through `app.provide`, register `onScopeDispose(_dispose)` and return it. Duplicate initialisation in the same app is an error |
| `useModal()` | Setup context -> `IModalController` | Inject the existing controller. Missing root initialisation is an error; do not silently create another owner in a route/component |
| `open<C>(component: C, props: ModalProps<C>, onClosed?)` | Typed SFC/props/completion -> `IModalHandle` | Reject opening after disposal; detach the previous owner, create the new owner, call `_mount`, then schedule `_completeClose` for the previous owner. Return the new owner's signal and captured `close` closure |
| `_mount(owner, component, props)` | One private mounted owner plus typed SFC/props | Append its container, `createVNode` with reserved signal/dismissal bindings, attach the captured app context and call `render(vnode, owner.container)` |
| `_close(owner)` | One private owner -> its `Promise<void>` close completion | Call `_detach(owner)`, then return `_completeClose(owner)`. This is the only target of the handle's `close()` and the mounted `onDismissed` callback |
| `_detach(owner)` | One private owner | Idempotently mark detached, abort its controller, `render(null, owner.container)` and remove that container. Clear the active reference only when it names this owner. It does not invoke `onClosed` |
| `_completeClose(owner)` | One detached owner -> cached `Promise<void>` | Schedule its captured callback once, cache completion before invoking it, and handle callback failure with existing `logHandledError`. Repeated calls return the same completion |
| `_dispose()` | Root lifecycle cleanup | Mark the controller disposed, then `_close` the active owner. `_completeClose` skips any callback not yet started, including one queued by replacement. Preserve existing app-disposal behaviour: teardown must not resume a Menu pause or navigate. Already-started close completions retain handled settlement |

A private owner needs only its container, abort controller, captured completion callback, detached flag and cached close completion. Vue retains the rendered VNode through its container; no duplicate VNode registry, generated ID or global modal form is needed. `dialog.close()` is the closure `() => _close(owner)`; it never looks up a later active owner.

`open` completes the previous callback after installing the replacement, so a re-entrant callback cannot be mistaken for a late close of the new modal. If `_mount` throws, `open` detaches the failed owner, settles applicable close callbacks and rethrows the mounting failure; no container or active reference is leaked. Root disposal skips a callback that has not started, matching the current `UiStateStore` disposal rule.

## Vue mounting and application scope

Call `useModalProvider()` once from `App` setup and register `_dispose` with that root scope. Other callers obtain the same owner through `useModal()` and application-scoped injection. The production and journey apps each have their own owner; there is no module-global active dialog. Root initialisation/injection belongs in the same composable module.

For each opening:

1. `open` calls `_detach(previous)` to abort its controller and unmount its VNode.
2. `open` creates a fresh container/controller/owner. `_mount` appends its container to `document.body` before rendering so focus can enter connected DOM.
3. `_mount` calls `createVNode(component, props)` with the owner's `signal` and `onDismissed: () => _close(owner)`, then attaches the existing application context.
4. `_mount` calls `render(vnode, owner.container)`; `open` retains that actual mounted owner.
5. `open` calls `_completeClose(previous)` exactly once, with failures handled through existing error reporting.

Preserve Pinia, router and application injections when mounting outside the main component tree. Publish the shared modal owner at application scope so a mounted modal can itself call `useModal`, including the draw-offer handoff. Do not create another Vue app or another Pinia/router instance for each modal.

`dialog.close()` calls `_close(owner) -> _detach(owner) -> _completeClose(owner)`: abort, unmount/remove, then complete its captured callback once. It clears the active reference only if that owner is still active. A late close of a replaced owner cannot unmount the replacement. Settle close completion even when its callback rejects, matching existing dismissal error handling.

Every opening mounts a new instance, including reopening the same component with the same props object. Actual unmount/mount supplies the lifetime boundary. There is no conditional-branch key, symbol key generator, activation projection, watcher, sequence counter or version token.

The existing focus directive releases listeners on Vue unmount and establishes focus on the newly mounted shell. Detach the old shell before mounting its replacement so only one active focus scope remains. Component unmount must not call a global close-current action.

## Component behaviour and async ownership

A modal receives its normal typed props plus the composable-supplied `AbortSignal`; it emits `dismissed`. The composable binds dismissal to that particular opening's `close`, rather than looking up whichever modal is current later.

Keep form state in the mounted component. Each submit captures its own signal and form, prevents duplicate starts through that form's working flag, and retains errors for retry. Domain actions continue through existing stores. Already-started domain mutations retain their current completion semantics.

After awaiting work, aborted actions must not navigate, open a follow-up modal, close a replacement or publish errors into another instance. Preserve the existing checks before create-navigation and draw handoff. Closing always belongs to the captured mounted owner.

Reuse the existing asynchronous form handling when moving it out of `ModalHost`; do not build a generic command dispatcher or add a second manager. Typed confirmation callbacks may be props of a shared confirmation component when that component must await them to display busy/error feedback. Vue emits remain the notification boundary; do not assume `emit` awaits an async listener.

### Named feature handlers

Move existing behaviour using these concrete owners/names. A helper is retained only when it has real work; simple dismissal remains Vue's `emit('dismissed')`, bound to `_close(owner)` by the composable.

| Owner | Function / callback | Existing action or migration |
| --- | --- | --- |
| `GameCreationModal.vue` | `_createGame(request)` | Move the current host handler: `_validateRequiredEngines(request)`, `gamesStore.createGame`, `uiStateStore.openTab`, `router.push`, then `emit('dismissed')` after signal checks |
| `GameCreationModal.vue` | `_confirmSetupStart(request)` | Move the setup handler: `_validateRequiredEngines`, then `gamesStore.startGameFromSetup`, then dismiss this opening |
| `GameCreationModal.vue` | `_validateRequiredEngines(request)` | Retain the existing required-seat engine checks using `EngineRuntimeService.getOptions`; both submission paths reuse it |
| `PlayerSelectionModal.vue` | `_confirmPlayerSelection()`, `_assignedPlayer(selection, colour)` | Move the existing selection/assignment logic; retain the unchanged-engine branch and call `gamesStore.reassignPlayer` |
| `AnalysisEngineSelectionModal.vue` | `_confirmAnalysisEngine()` | Retain `gamesStore.addAnalysisEngine`, captured seat lookup and eligible `gamesStore.retryAnalysis` |
| `PromotionModal.vue` | `_choosePromotion(move)` | Return the offered raw candidate through `selected`; `Chessboard._choosePromotion` validates its current candidates and emits `moveAttempted` to GameView |
| Shared `ConfirmationModal.vue` | `_confirm()` | Busy/error guard, await its typed `confirm(signal)` prop, then dismiss this opening on success. Each caller supplies one explicit operation |
| `DrawResponseModal.vue` | `_acceptDraw()`, `_declineDraw()` | Explicit `gamesStore.acceptDrawOffer` / `gamesStore.declineDrawOffer`, then dismiss. Keep dismissal disabled until a response succeeds |
| `GameView.vue` | `_handleDraw()`, `_offerDraw(game, offeringColour, signal)` | Existing control opens the offer confirmation; its confirm callback calls `_offerDraw`. That awaits `gamesStore.offerDraw`, checks the signal and calls `modal.open(DrawResponseModal, responseProps)` |
| `GameView.vue` | Existing `_openCustomGame()` | Keep `_handleMenuInterruptionRequested` and pass the captured `_handleMenuInterruptionCompleted(interrupted)` callback to `modal.open(GameCreationModal, props, onClosed)` |
| `GameView.vue` | Existing `_requestPlayerSelection(colour)`, `_requestAnalysisEngine()`, `_reconcileTimeout()`, `_toggleBoardEdit()` | Replace their corresponding `showModal` calls with direct `modal.open` calls; keep their existing permission/clock/context checks |
| `GameView.vue` | `_requestSetupStart()`, `_requestResignation()` | Open `ConfirmationModal` with a callback to `gamesStore.resignGame`; replace the previous inline modal-state construction; setup opens `GameCreationModal` with its `gameId` |
| `HomeView.vue` | `_openCustomGame()` | Open `GameCreationModal`; leave `_quickNewGame` unchanged |
| `SettingsView.vue` | `_requestDiscardChanges(targetRoute)`, `_discardChangesAndNavigate(targetRoute, signal)` | Share the opener between `onBeforeRouteLeave` and `_requestReturn`; confirm discards pending settings, checks the signal and calls `router.push` |
| `SettingsView.vue` | `_requestResetSettings()` | Open `ConfirmationModal` with a callback to `settingsStore.resetSettings` |
| `SavedGamesView.vue` | Existing `_run(action, importAction)` | Preserve import failure handling; mount the acknowledgement component directly for import errors |

The host's `_confirmSimpleAction` is removed, not renamed or moved into the composable. The old host `_run` and `_closeModal` are also removed: each mounted form handles its own submission feedback, and Vue dismissal events call the captured `_close(owner)`.

## Caller migration and preserved behaviour

| Existing flow | Direct mounting and behaviour |
| --- | --- |
| Home / Game custom creation | Open the creation modal, reuse `NewGameModal`, retain engine-readiness validation and create/open-tab/navigation. Game menu interruption supplies the same captured close callback |
| Start from setup | Open the setup adapter of the existing form; submit `startGameFromSetup` against the prepared board |
| Player / analysis-engine selection | Mount the corresponding form with typed game/selection props; retain unchanged-assignment, duplicate-profile and retry policies |
| Promotion | `Chessboard._commitTarget` mounts the chooser with its legal raw candidates and moving colour. Selection returns through the existing board event and GameView continuation checks before canonical store acceptance |
| Resign / reset / dirty-settings leave | Use the shared confirmation UI with that feature's explicit action and existing labels, cancellation and error handling |
| Local draw offer / response | Offer action mounts the response modal only after success and a live signal check. Response requires explicit Accept/Decline and remains non-dismissible |
| Import error / blocked editing / timeout review | Use acknowledgement UI with existing text/data and no unrelated domain operation |
| Legacy `DeleteGame` modal kind | There is no production opener or rendered host branch today. Do not invent a deletion surface during migration; remove unused modal declarations only after checking all remaining references |

Migrate the current openers in `HomeView`, `GameView`, `SettingsView` and `SavedGamesView`, plus the draw follow-up. After all callers move, remove `ModalHost` from `App` and remove the obsolete shared modal state/form/controller/actions from `UiStateStore`. Remove obsolete modal-kind/payload declarations only when no callers/tests depend on them. Domain/game APIs, saved data, raw-move acceptance and unrelated UI-store state stay intact.

This supersedes the earlier promise to preserve `showModal`/`hideModal` as the permanent architecture: callers now use the requested composable directly. No compatibility bridge remains.

## Function flows

### MOD-F01 - Open

`App.setup -> useModalProvider -> app.provide(controller)`; each caller uses `useModal()` to inject it.

`feature handler -> modal.open(Component, props, onClosed?) -> _detach(previous) -> create owner -> _mount(owner, Component, props) -> createVNode/render -> _completeClose(previous) -> return dialog handle`.

Same-component reopening runs the same `_detach`/`_mount` flow and creates fresh local form state. Mount failure runs `_detach(failedOwner)` and settles captured callbacks before rethrowing.

### MOD-F02 - Submit

`button/form event -> _confirm / _createGame / _confirmSetupStart / _confirmPlayerSelection / _confirmAnalysisEngine -> local busy/error guard -> named store action -> emit('dismissed') -> _close(owner)`.

On failure the owning handler retains local feedback and clears its working flag for retry. It does not emit dismissal. Signal checks prevent late navigation and follow-up UI.

### MOD-F03 - Close or replace during work

`Cancel/permitted Escape/backdrop -> emit('dismissed') -> _close(owner) -> _detach(owner) -> _completeClose(owner)`.

`dialog.close()` calls the same `_close(owner)` directly. Replacement instead runs `open -> _detach(previous) -> _mount(next) -> _completeClose(previous)`. Repeated/stale closes return the existing completion and cannot detach the next owner.

### MOD-F04 - Draw handoff

`GameView._handleDraw -> modal.open(ConfirmationModal, offerProps) -> ConfirmationModal._confirm -> GameView._offerDraw(game, colour, signal) -> gamesStore.offerDraw -> signal.throwIfAborted -> modal.open(DrawResponseModal, responseProps)`.

The second `open` detaches the offer owner before mounting the response. Old `_close(offerOwner)` is harmless. Response buttons use `_acceptDraw` / `_declineDraw`, then `emit('dismissed') -> _close(responseOwner)`.

### MOD-F05 - Creation and setup

`HomeView._openCustomGame / GameView._openCustomGame -> modal.open(GameCreationModal, props, onClosed?) -> NewGameModal.createRequested -> _createGame(request) or _confirmSetupStart(request) -> _validateRequiredEngines -> existing creation/setup store actions -> signal check -> emit('dismissed') -> _close(owner)`.

`_createGame` keeps its additional pre-navigation signal check before `uiStateStore.openTab` / `router.push`. The captured Game menu close callback uses `_handleMenuInterruptionCompleted(interrupted)`. Dismissal does not roll back a completed domain mutation.

### MOD-F06 - Promotion

`Chessboard._commitTarget -> modal.open(PromotionModal, { moves, colour, onSelected }) -> PromotionModal._choosePromotion(move) -> selected(move) -> Chessboard._choosePromotion -> _emitMove -> moveAttempted -> GameView._requestMoves -> existing history confirmation / _applyMoves -> gamesStore.makeMove`.

Cancel uses `emit('dismissed') -> _close(owner)` without submitting a move. Its captured close callback clears only that opening's board input. External board/mode/permission changes and board unmount clear the pending candidates and close the owned handle. A replaced chooser's callback cannot clear a newer chooser; retained old choices are rejected by the aborted signal and candidate identity. No inline chooser or store-backed alternate promotion path remains.

Root cleanup is `onScopeDispose -> _dispose -> suppress unstarted onClosed -> _close(activeOwner) -> _detach/_completeClose`; it never opens a replacement or resumes actual play during teardown.

## Scenarios and tests first

| Scenario | Observable assertion |
| --- | --- |
| MOD-S01: direct component mounting | `useModalProvider`/`useModal` share one controller; `open`/`_mount` pass typed props/context. Failed mount cleans up and rethrows; no enum/registry routing |
| MOD-S02: close ownership | Closing a current, already-closed or replaced handle is safe and never selects another domain operation |
| MOD-S03: unchanged mounted instance | Local input/focus survives unrelated application publications and busy/error edits |
| MOD-S04: different-component replacement | Old instance/container/focus listeners release before the new one mounts |
| MOD-S05: same-component replacement | A fresh instance/form appears even when the component and props object are reused |
| MOD-S06: late completion | Old success/error cannot close, navigate or change the new modal's state |
| MOD-S07: duplicate confirmation | Repeated click/keyboard activation starts one operation |
| MOD-S08: failure and retry | Current local feedback remains visible, working resets and retry succeeds |
| MOD-S09: dismissal and completion | Cancel, permitted Escape/backdrop and replacement abort the owner and invoke its close callback once; callback failures are handled |
| MOD-S10: draw handoff | Response inherits stores/router/modal injection, receives focus and remains open after old completion; Accept/Decline route correctly |
| MOD-S11: creation/setup | Preserve existing validation/engine readiness; dismissed pending creation cannot navigate; menu close completion retains pause ownership |
| MOD-S12: selection forms | Preserve keep/local/none/profile choices and analysis assignment/retry rules |
| MOD-S13: promotion | All offered Q/R/B/N choices return raw fields through the board event; Cancel submits nothing; board replacement, permission loss, unmount and replacement invalidate old choices; historical promotion still reaches GameView confirmation |
| MOD-S14: shared confirmations/notices | Each caller supplies its own operation/data; acknowledgements cannot invoke unrelated actions |
| MOD-S15: application disposal/isolation | `_dispose` unmounts/aborts the active owner, suppresses unstarted close callbacks and forbids later `open`; another app/journey has independent ownership; no detached DOM/listeners remain |

After approval, write mounting/ownership tests first, especially same-component reopening, stale handle closure, app-context injection and callback completion. Adapt the existing promotion and dialog-lifecycle tests to the composable boundary. Preserve their behavioural assertions rather than retaining tests of removed shared modal fields.

Then implement the composable, migrate the callers/forms, remove the host/obsolete store fields and run affected unit/mounted tests, `npm run check:code`, type checking/build and real dialog/keyboard journeys. No new observer or stylesheet boundary is needed. The pending premove implementation remains separate.

## Implementation evidence

The mounting and confirmation tests were written before production implementation. Their initial run failed at module resolution because the planned modules did not exist (`test-results/ModalRed.json`); this was an API/module baseline, not a behavioural reproduction against the former host. The implemented tests then exercised real Vue mounts. Existing lifecycle, promotion, view and application tests were migrated to the new boundary.

| Scenarios | Verification owner |
| --- | --- |
| MOD-S01-05, S09, S15 | `src/components/modals/__tests__/ModalComposable.spec.ts`: connected mounting/context, current/stale/repeated close, unchanged local input across app publication, different/same component replacement, callback ordering/failure, failed mount cleanup, disposal and app isolation |
| MOD-S06 | `journeys/__tests__/cleanup/Dialog.spec.ts`: pending reassignment success/failure and dismissed creation cannot affect a replacement or navigate |
| MOD-S07-08 | `src/components/modals/__tests__/ConfirmationModal.spec.ts`: duplicate submission, failure/retry and aborted late delivery |
| MOD-S09-10, S14 | Browser usability Dialog/Keyboard and settings Navigation: Escape/backdrop, focus cycling/restoration, draw response handoff, discard and reset |
| MOD-S11-12 | GameView menu tests, creation/engine/setup application tests and browser Fresh/Player/Analysis/Setup/Menu journeys |
| MOD-S13 | `src/components/modals/__tests__/PromotionModal.spec.ts`: four raw choices, cancellation and aborted choice rejection; board tests cover replaced candidates and browser promotion/Keyboard journeys exercise the mounted chooser |

`UiStateStore` retains shell/session/layout ownership. Its removed modal lifecycle assertions now belong to the composable tests. The obsolete `ModalState` contract is removed, and current architecture/process-flow docs name the new owners. Pending premove source/tests remain separate and unchanged.


## Original migration verification

- `test-results/ModalUnitFinal.json`: **681 passed**, four unchanged movement-candidate cases skipped, 92 files passed. The separately pending `Premove*.spec.ts` files were excluded; no premove source/tests were changed.
- `test-results/ModalJourneyResults.json`: 53/54 browser cases passed initially. The empty-screen case expected an obsolete Settings heading; its assertion now checks the settings/session route and current Session heading. `test-results/ModalFreshFinal.json` records its successful rerun.
- `test-results/ModalResultFinal.json`: eight further browser cases passed for resignation, draw cancellation/decline/accept/withdrawal and separate timeout acknowledgements. **62 distinct browser cases passed** across these runs, with no configured retries.
- Final `npm run build` passed, including `npm run check:code` and Vue TypeScript checking. `git diff --check` passed.

The implementation retains all MOD-F01-06 flows and MOD-S01-15 scenarios above. No watcher, component registry, render-key generator, extra Vue app, domain/game API change or premove implementation was introduced.

## Remaining-surface correction - 23 October 2026

The original migration incorrectly exempted local dialog owners. All six remaining surfaces now use the same composable; tests stay in their existing colocated folders. Production component files remain Vue-only, with `ModalComposable.ts` under `src/composables` and `FocusScope.ts` under `src/directives`.

| Surface | Functions and flow | Preserved constraints |
| --- | --- | --- |
| Promotion (MOD-F06 / MOD-S13) | Revised above; `PromotionModal` is a chooser with `moves`, `colour` and `selected(move)` | No game/store dependency; existing raw event and history/takeback confirmation remain authoritative |
| Navigation (MOD-F07 / MOD-S16) | `NavigationFrame._openDrawer -> modal.open(NavigationMenuModal, { content })`; named slot renderers `_brand`, `_actions`, `_footer` retain caller content; dismissal closes that opening | Drawer layout, responsive width and focus remain; another modal replaces the drawer. A bubbling old drawer dismissal cannot close the replacement. Frame unmount closes its captured handle |
| History continuation (MOD-F08 / MOD-S17) | `GameView._requestMoves -> modal.open(ConfirmationModal, { confirm: signal => _confirmContinuation(pending, signal) }) -> _applyMoves` | Capture raw moves/game/node; recheck signal, selected context, ongoing result, pause, explicit analysis and takeback permission. `_closeContinuation` runs at input/navigation/route/unmount boundaries |
| Engine profile (MOD-F09 / MOD-S18) | `SettingsView._openEngineEditor -> modal.open(EngineProfileModal, { engine, index }) -> _saveEngine -> _engineOptions` | Fresh local form/error; preserve add/copy/edit, duplicate-name checks and option parsing. `_closeEngineEditor` closes the handle on route update/leave and unmount |
| Save replacement (MOD-F10 / MOD-S19) | `SavedGamesView._requestOverwrite(target) -> ConfirmationModal._confirm -> _confirmOverwrite(target, signal) -> _writeSave` | Capture exact game/name; one write per confirmation; disable confirmation and all dismissal while writing; retain local/view errors and retry. `_closeConfirmation` runs on committed route change and unmount; aborted success cannot select the old save |
| Save deletion (MOD-F11 / MOD-S20) | `SavedGamesView._requestDelete(entry) -> ConfirmationModal._confirm -> _confirmDelete(entry, signal) -> deleteSave -> refresh/fallback` | Capture exact game/save identity; preserve selection refresh and last-group fallback; deletion failures close the confirmation after settlement and report library feedback following refresh, preserving missing-target selection and route fallback |

`ModalDialog` owns ordinary dialog focus; `NavigationMenuModal` owns its drawer focus. No view or board contains an inline focus surface, Teleport drawer or ModalDialog template. The removed inline promotion CSS has no remaining owner and is removed.

Six application regression scenarios were added before this correction. All six failed against the former implementation, including shared-owner replacement of the drawer. The initial red report was written to `test-results/RemainingModalRed.json`; that temporary report was subsequently removed by concurrent browser-artifact cleanup. Existing board/save/history tests now exercise the mounted boundary, with additional paused/analysis continuation guards and overwrite dismissal-lock coverage.

### Correction verification

- `node_modules/.tmp/modal-verification/RemainingModalUnitFinal.json`: **696 passed**, four unchanged movement-candidate cases skipped, no failures. The pending `Premove*.spec.ts` files were excluded; no premove source/tests were changed. The report contains only the real workspace, with no temporary-copy suites.
- `RemainingModalCurrentRoot.json` in the same report folder confirms all six new application scenarios pass against the current workspace. Its additional six results are the same scenarios discovered in the temporary browser-test copy, not additional coverage.
- Affected browser journeys exercised promotion, history continuation, engine editing, save replacement/deletion, keyboard focus and mobile navigation. The 43-case settings/save/usability run recorded 38 passes and five obsolete-selector failures in `RemainingModalBrowserStable.json`. After correcting those selectors, `RemainingModalBrowserRepairs.json` records four successful cases, and `RemainingModalDesktopFinal.json` records the final successful desktop case. All 43 distinct cases passed across these runs; configured retries were disabled. `RemainingModalHistoryFinal.json` also records the successful targeted history rerun after an artifact-write failure. The earlier promotion/history/deletion run was interrupted during concurrent artifact cleanup and is not claimed as a clean aggregate report.
- Final `npm run build` passed, including Vue TypeScript checking and `npm run check:code`. No observers were introduced. Production focus surfaces are confined to `ModalDialog.vue` and `NavigationMenuModal.vue`; the remaining component files are Vue-only except their retained colocated tests.
