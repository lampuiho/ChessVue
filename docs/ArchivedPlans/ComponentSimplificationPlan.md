# Component props and event simplification plan

Reviewed and corrected after the agent review on 23 October 2026 against source baseline `24ebd15` (store dependency reflow). **Status: implemented and verified on 24 October 2026.** The review covers all 21 baseline production `.vue` files under `src/components`, their production callers, `App`, all four route views, and the store/modal actions reached by their events. Component tests and journey callers were checked for migration impact. Premove implementation, reactive-state migration and store dependency reflow are already part of the baseline.

The main simplification is to let game-specific components read their own feature state and perform actions that their parent currently just forwards. `GameView` retains workflows that own a rendered input context, playback, historical continuation or Menu interruption. Local handling still calls the existing stores; it does not move chess rules, engine ownership or persistence into components.

## Review basis and constraints

- Source and actual callers determine the current contracts. Some presentation documents describe proposed components that do not exist, or claim existing components have no markup. Those descriptions are not evidence of reuse or a reason to retain an interface.
- Follow [AGENTS.md](../AGENTS.md), the [archived code cleanup ownership decisions](ArchivedPlans/CodeCleanupPlan.md), the [modal lifecycle design](ArchivedPlans/ModalComponentDesign.md), and the [raw move boundary](ArchivedPlans/RawMoveSubmissionDesign.md).
- Preserve the implemented [premove behaviour and test contracts](ArchivedPlans/PreMovePlan%28ToDo%29.md), including all PRE-S01-PRE-S25 scenarios. This plan changes component ownership, not premove, pause, history, analysis or settings behaviour. There is no intentionally failing premove baseline to exempt from regression checks.
- A small prop count alone is not the objective. Replace redundant sources and parent relays with a clear owner. Do not conceal the same dependencies inside a large `context`, `options` or callback object, or replace named events with a generic command event.
- Feature components may use their existing stores and `useModal`. Keep the board and drawing primitives explicit about their rendering inputs. Do not add a global game controller or an event bus.
- All new composables belong outside `src/components`, use `useXxxx` names and keep implementation returns inferred. Use computed reads and explicit actions/lifecycle hooks; add no watchers, subscriptions for reactive effects, invalidation counters or polling.
- Preserve the implemented [workspace counter removal](ArchivedPlans/WorkspaceRevisionRemovalPlan.md). Games and their fields/arrays are already reactive, and `HistoryPanel.revision` has been removed. Feature components read the actual data used by each computed projection; add no holder registry or manual publisher.
- Preserve the public APIs from the implemented [store dependency reflow](ArchivedPlans/StoreDependencyRestructuringPlan.md). Moved UI handlers still call `GamesStore` entry points, especially navigation, exit-analysis, resume, resignation and draw acceptance, whose wrappers own necessary coordination. Do not bypass them by calling their lower-level composables directly.
- The separate [engine installation/profile redesign](EngineInstallationReworkPlan.md) remains planned. It adds no implemented contract changes to this baseline and is outside this component refactor.

## Component inventory and decisions

Counts below are declared prop names and event names, including provider-supplied `signal`. `ChessPiece` has the two fields of `IChessPiece`. Counts describe interface surface, not defects; a new `gameId` is included wherever it replaces forwarded state.

| Component | Baseline props / events | Implemented props / events | Decision |
| --- | --- | --- | --- |
| [AnalysisPanel](../src/components/AnalysisPanel.vue) | 7 / 8 | 2 / 1 | Use `gameId` and `disabled`; read seats, display policy and folds locally. Handle folds and engine management locally; retain `moveSelected`. |
| [Chessboard](../src/components/Chessboard.vue) | 10 / 7 | 10 / 7 | Retain canonical input, premove display/colour/highlighting and the captured cancellation event, with the specific justifications below. Selection, palette, drag and promotion already belong locally. |
| [GameControlPanel](../src/components/GameControlPanel.vue) | 4 / 9 | 3 / 3 | Use `gameId`, `mode`, `canTakeBack`. Handle six independent control flows locally; retain the three rendered-input actions. |
| [GameTabs](../src/components/GameTabs.vue) | 2 / 2 | 0 / 0 | Read open games and committed selection locally; own switching and closing. |
| [HistoryPanel](../src/components/HistoryPanel.vue) | 5 / 3 | 2 / 1 | Use `gameId` and `disabled`; own tree projection and saved collapse state. Both history targets emit `nodeSelected`; `revision` is already removed. |
| [MenuBar](../src/components/MenuBar.vue) | 3 / 8 | 1 / 5 | Use `gameId`; remove unused deletion and invariant capability flags. Own quick creation and close; retain the five Menu-interruption events. |
| [NavigationFrame](../src/components/NavigationFrame.vue) | 0 / 0 | 0 / 0 | Retain local drawer/desktop actions and its three content slots; it already avoids parent relays. |
| [PlayerPanel](../src/components/PlayerPanel.vue) | 6 / 1 | 6 / 0 | Replace `player` with `gameId`; open the player chooser locally. Keep the shared clock, turn and captured-material projections. |
| [AppIcon](../src/components/common/AppIcon.vue) | 2 / 0 | 1 / 0 | Remove unused `strokeWidth`; use the existing default stroke width. Keep `name`. |
| [ChessPiece](../src/components/common/ChessPiece.vue) | 2 / 0 | 2 / 0 | Retain `kind` and `colour`; each selects actual artwork. |
| [AnalysisEngineSelectionModal](../src/components/modals/AnalysisEngineSelectionModal.vue) | 3 / 1 | 2 / 1 | Remove `currentAnalysisEngines`; resolve the canonical assignments using `gameId`. |
| [ConfirmationModal](../src/components/modals/ConfirmationModal.vue) | 9 / 1 | 9 / 1 | Retain its independently used presentation, action and lifetime inputs; reasons below. |
| [DrawResponseModal](../src/components/modals/DrawResponseModal.vue) | 3 / 1 | 2 / 1 | Remove `respondingColour`; read it from the actual game's draw offer. |
| [EngineProfileModal](../src/components/modals/EngineProfileModal.vue) | 3 / 1 | 3 / 1 | Retain the editable seed, replacement destination and modal lifetime; copy and edit need different destinations. |
| [GameCreationModal](../src/components/modals/GameCreationModal.vue) | 2 / 1 | 2 / 1 | Absorb the single-use form, so form and submission have one owner. Retain `gameId?`, `signal`, and provider dismissal. |
| [MessageModal](../src/components/modals/MessageModal.vue) | 6 / 1 | 6 / 1 | Retain actual acknowledgement/error variants and the provider contract. |
| [ModalDialog](../src/components/modals/ModalDialog.vue) | 4 / 1 | 4 / 1 | Retain the shared accessible shell, its four used inputs and dismissal notification. |
| [NavigationMenuModal](../src/components/modals/NavigationMenuModal.vue) | 2 / 1 | 2 / 1 | Retain transported slot content, provider lifetime and captured-owner dismissal. |
| `NewGameModal` (removed) | 5 / 2 | Removed | Merge into `GameCreationModal`; remove its five forwarded props and create/cancel relay events. |
| [PlayerSelectionModal](../src/components/modals/PlayerSelectionModal.vue) | 4 / 1 | 3 / 1 | Remove `currentPlayer`; resolve the opening's initial player from `gameId` and `colour`. |
| [PromotionModal](../src/components/modals/PromotionModal.vue) | 3 / 2 | 3 / 2 | Retain raw candidates, rendering colour, opening lifetime and the two distinct notifications. |

The implemented interface is **20 components, 63 declared props and 28 declared events**, compared with **21 components, 85 props and 51 events** at the reviewed baseline. These corrected totals include the implemented premove interface and exclude the already removed `HistoryPanel.revision`. These counts describe the interface reduction; the action and ownership checks below remain the correctness criteria. The numbered actions retain the approved implementation design. `SettingsView.appearanceChanged` is reviewed separately below and is outside these component totals.

## Actions to simplify

### 1. Remove duplicated modal inputs and the form relay

`PlayerSelectionModal` already loads the game by ID before reassignment. It will initialise its local choice from that game's colour seat instead of also accepting `currentPlayer`. Capture the opening's initial player for the Keep label and initial selection; do not reset an edited form on later publications. Update `GameView` and the direct journey openers to pass only ID and colour.

`AnalysisEngineSelectionModal` already resolves the game to add an engine. It will compute excluded engines from that game's canonical `analysis.seats`, rather than receive a second copied assignment list. Preserve inclusion of empty, restored, failed and stopped assignments. Read the reactive assignment collection so changes update the available choices.

`DrawResponseModal` will capture the opening's actual game and `drawOfferState` and use that offer's `respondingColour`. The opener will pass only `gameId`. Before starting acceptance or decline, check that the opening is still live and the store still contains that game and offer. A missing or replaced offer disables the old response and settles that opening through an explicit action or update lifecycle boundary, without a watcher. This is an opening/submission-time ownership check using the actual offer, not a generated token.

This refactor preserves the existing store acceptance semantics. `GamesStore.acceptDrawOffer(game)` currently awaits turn cancellation before finalising, with no offer-identity recheck after that await. The modal check does not guarantee offer identity throughout that store operation. A stronger domain guarantee would need a separately specified store change and a focused replacement-during-acceptance test; it is outside COMP-01.

`NewGameModal` has one production consumer, `GameCreationModal`. Its five props (`settings`, `engines`, `setupGame`, `errorMessage`, `busy`) and two events exist to connect the form to the owner that actually submits it. It will be simplified by merging the form, validation and request construction into `GameCreationModal`, where `_submit` directly awaits the appropriate create/start action. Keep private form/request helpers to keep functions short.

After the merge, the mounted component owns draft edits, validation, engine checks, busy/error feedback and submission. `gameId` still distinguishes creating a workspace from starting the prepared game. Preserve the present sources of defaults and inventory: the form currently takes defaults from `draftSettings`, while configured engines come through `EnginesStore`. Changing accepted-versus-draft settings policy is a separate decision. Reopening still creates a fresh form through actual mount/unmount, not a watcher.

`AppIcon.strokeWidth` has no caller in application or journey code. It will be simplified to the current fixed default, removing the optional prop and fallback expression.

### 2. Let panels own folds and analysis management

`HistoryPanel` will take `gameId` and `disabled`. It will derive the root, paths and rows directly from `GamesStore`, and read/update `UiStateStore.layoutState.historyCollapsed`. Its collapse button will explicitly update and save the layout; remove `collapsed`, `collapseToggled` and the corresponding `GameView` relay.

The Live position button will resolve the live node locally and emit the existing `nodeSelected(node)`. `GameView._navigateToNode` remains the single navigation workflow. Remove `returnToLiveRequested` and `_returnToLivePosition`; the parent does not need two entry points to the same owned operation.

`AnalysisPanel` will take `gameId` and the parent-owned move `disabled` flag. It will read visible analysis through `GamesStore.getVisibleAnalysis`, saved folds through `UiStateStore`, and display/start/add permissions from the game and settings. Remove the forwarded `seats`, `collapsed`, `expandedByIndex`, `showMoves`, `startDisabled` and `canAdd` props.

The following analysis emits will become explicit component actions:

| Current emit | Local action |
| --- | --- |
| `collapseToggled` | Toggle and save `analysisCollapsed`. |
| `engineExpandedToggled(index)` | Toggle and save that assignment index's fold state. |
| `refreshRequested` | Await `gamesStore.refreshAnalysis` for the captured game. |
| `retryRequested(index)` | Await `gamesStore.retryAnalysis` for the selected seat. |
| `stopRequested(index)` | Await `gamesStore.stopAnalysis` for the selected seat. |
| `engineAddRequested` | Open `AnalysisEngineSelectionModal` for the game's ID. |
| `engineRemoveRequested(index)` | Remove that assignment and reconcile/save its corresponding fold entry in the same feature action. |

Move `_removeAnalysisEngine` with its layout-array reconciliation; moving only the store call would lose existing behaviour. Capture the actual seat before awaiting work, so another removal cannot redirect an action to the seat that later occupies its index. Show action/save failures in the owning panel with existing global feedback styles. Do not add an error event just to reconstruct the former forwarding chain.

Keep `moveSelected` and the parent-owned move permission. Preserve the current three suggestion routes: a local due turn submits the first move, explicit/free/result analysis plays the selected legal prefix, and an eligible off-turn selection submits only the clicked local move after source-colour/parity and projected-candidate checks. Do not enqueue preceding opponent replies, copy the selected raw move entries or preflight a premove as canonical due-turn play. A pause may block moves while refresh/retry/stop/removal remain available; board edit blocks startup; score-only evaluations ignore saved collapse flags. These are separate permissions, so do not combine them into one blanket disabled state.

`GameView` continues to choose whether the history and analysis regions are mounted from the two shared visibility preferences. It no longer prepares their tree/seat props or owns their fold handlers.

### 3. Let tabs and the game menu own independent actions

`GameTabs` has one production caller. Its parent selection handler changes tab/session state and navigates; its close handler first clears premoves for the closing game. It will derive its existing ordered list from available games filtered by `openGameIds`, read the active committed route, and hide its own strip when at most one game is open. Move those actions with their existing effects, then remove the two props, two emits and `GameView`'s `tabs`, `_selectTab` and `_closeTab` plumbing.

Share the close action with `MenuBar` through a narrowly scoped `useGameTabActions` composable in `src/composables`. Preserve the close order: resolve the game being closed, call `gamesStore.clearPremoves(closingGame)` if it exists, close that tab through `UiStateStore`, then navigate to the active fallback or Home. This applies to active, background and paused tabs and clears only the target game's queue; closing a tab does not dispose its actual turn or delete the game or its saved files. Temporary tab selection and route visits preserve both games' queues. Retain the current close fallback and tab ordering. Ordinary selection requests a route; the existing `App.afterEach` checkpoint publishes selection after successful navigation. Do not pre-publish a selected tab when navigation is rejected. Existing `GameView` route hooks still cancel playback and complete Menu-owned activation on an actual transition.

Migrate [PRE-S19](../src/views/__tests__/PremoveView.spec.ts) to real tab-selection/close buttons when the events are removed. Keep its two-game assertions: switching away and back preserves each queue reference, explicitly closing one game clears that queue, and the other game's queue remains the same object.

`MenuBar` is mounted only by `GameView`, always with `canSave` and `canClose`, and never with `canDelete` or a deletion handler. It will take the explicit target `gameId`, remove all three flags, and remove the unused Delete button and `deleteGameRequested` event. Its save/close availability follows whether that target game exists.

Quick creation and close will run locally. The identical quick-game request/create/open/navigate flow in `HomeView` and `GameView` will become one `useQuickGame` action used by Home and MenuBar. Preserve its two-local-player defaults, time control and analysis options. Keep busy/error state with the initiating UI, prevent duplicate submissions, and settle/cancel UI follow-up at its lifecycle boundary. Remove `quickNewGameRequested`, `closeGameRequested` and the duplicated view functions. Quick game keeps its current behaviour without adding a Menu pause.

The other five menu events remain because they enter `GameView`'s Menu-interruption workflow; the exact reasons are in the retention table. `NavigationFrame` continues to own drawer opening and dismissal.

### 4. Let the player strip and control panel own their independent flows

`PlayerPanel.playerSelectionRequested` only reaches a parent function that chooses the player's colour and opens the chooser. There is no playback drain or Menu-pause workflow in that handler. It will be simplified by opening `PlayerSelectionModal` in `PlayerPanel` itself.

Replace the `player` prop with `gameId`; derive the current player from that game and the retained `colour`. The chooser then needs no duplicated player object. Keep `selectionDisabled` for the parent's playback lock, and combine it locally with board-edit eligibility. Remove `GameView._requestPlayerSelection`, `topPlayer` and `bottomPlayer`. The six-prop count remains the same, but one source of duplicated player state and the parent event disappear.

`GameControlPanel` will add `gameId`, retain `mode` and `canTakeBack`, and derive `canPause` and `drawPending` locally. These six events will become local handlers:

| Current emit | Local action and behaviour to preserve |
| --- | --- |
| `pauseRequested` | Pause the captured game with `PauseReason.Manual`. |
| `resumeRequested` | Resume only `PauseReason.Manual`; preserve other pause owners. |
| `boardEditRequested` | Move `_toggleBoardEdit`, including its in-game-analysis explanation and store transition. |
| `startGameRequested` | Open `GameCreationModal` for the prepared game's ID. |
| `resignRequested` | Move the resignation confirmation, capturing the game and actual live-side colour. |
| `drawRequested` | Move `_handleDraw`/`_offerDraw`, preserving incoming accept, outgoing withdraw and the local-local offer/response handoff. |

For resign/draw, resolve the actual live position rather than assuming the rendered historical position is the live turn. Keep confirmation targets and abort checks captured by their modal opening. Use component-local feedback for failures. These actions still use store assertions; template visibility is not the mutation guard.

Retain `takeBackRequested`, `analysisRequested` and `exitAnalysisRequested` through the existing captured `inputActions`. The paused contextual Analyse/Exit button can keep calling those same actions in `GameView`; do not duplicate their workflow inside the control panel.

### 5. Reduce repeated modal action code

`GameCreationModal`, `PlayerSelectionModal`, `AnalysisEngineSelectionModal` and `DrawResponseModal` each implement the same busy/error/abort `_run` wrapper. Extract a small `useModalAction(signal)` composable that owns those two feedback values and runs one action at a time. It may return whether the action completed while the opening was live; the feature emits `dismissed` after success.

Keep feature-specific work, cancellation policy and chained modal transitions in their feature components. The helper must not close whichever modal happens to be active, become a command dispatcher, restart work reactively or roll back an already-started domain mutation. `ConfirmationModal` can use the same execution helper while retaining its own `canDismiss` policy and awaited `confirm(signal)` callback.

## Retained events: concrete justifications

These are the complete planned retained component event groups. An interface is not retained merely because it is currently called presentational or might be reused later.

| Retained event | Why the receiver still owns the action |
| --- | --- |
| `Chessboard.moveAttempted(IMoveRaw)` | [GameView](../src/views/GameView.vue) binds the attempt to `renderedBoard` through `inputActions.move`, routes off-turn input to premoves, handles historical-continuation confirmation and owns the cancellable playback/submission route. The board only owns the gesture and legal or premove raw candidates. Calling `makeMove` locally would bypass that workflow. |
| `Chessboard.premovesCancelled` | `inputActions.cancelPremoves` enters `_runInputAction` with the captured rendered-board owner, drains playback, checks that the context still belongs to that owner, closes continuation and calls `gamesStore.clearPremoves` for that game. The board owns cancellation gestures and candidate selection, not the actual queue. Clearing its local selection alone would leave completed intentions queued. |
| `Chessboard.chessPieceToggled`, `chessPieceDeleted`, `chessPieceMoved`, `boardCleared`, `boardReset` | The board renders a supplied `IBoardPosition`, not the canonical game's mutable root. `GameView` binds that snapshot to the actual game receiving the edit. [GameBoardEditComposable](../src/state/game/GameBoardEditComposable.ts) asserts edit state and owns root/history replacement, position invalidation, analysis refresh and canonical mutations. Mutating the supplied position would bypass these effects; adding another game identity to the snapshot component would require a second ownership reconciliation. Keep its existing explicit input/output boundary. |
| `HistoryPanel.nodeSelected` | `_navigateToNode` cancels/drains the view's playback owner, checks the captured game, closes a pending historical continuation and then navigates through the store. Both a row and the live-position target must use that one workflow. |
| `AnalysisPanel.moveSelected(readonly IMoveRaw[])` | `_playAnalysisLine` selects first-move-only on a local due turn, whole-prefix playback during exploration, or only the clicked local candidate during an eligible off-turn. The premove branch checks source colour/parity and projected movement without enqueuing opponent replies. `_requestMoves` also handles historical continuation; canonical `_applyMoves` preflights the whole prefix and owns delayed playback cancellation. These routes preserve raw entry references and the captured input owner. Engine management does not need these resources, which is why its events are removed separately. |
| `GameControlPanel.takeBackRequested`, `analysisRequested`, `exitAnalysisRequested` | All three enter `_runInputAction` through the captured `renderedBoard` owner. It drains playback, rejects an action from a replaced context and closes continuation before mutation. A direct store call from these buttons would lose that ordering and ownership check. |
| `MenuBar.homeRequested`, `loadGameRequested`, `saveGameRequested`, `settingsRequested` | `_handleMenuInterruptionRequested` cancels playback and applies `PauseReason.Menu` before navigation when configured. Activation later resumes only the Menu owner. A local `router.push` would miss that explicit pause/cancellation boundary. |
| `MenuBar.customNewGameRequested` | The same interruption workflow also captures the interrupted game in the modal close callback. Cancelling custom creation resumes that game only if it is still displayed; creating a different game keeps the interrupted one paused. The modal cannot reconstruct this view-owned continuation. |
| `ModalDialog.dismissed` | This shell is used by confirmations, editable forms, messages and promotion. Its caller decides whether dismissal is allowed and what completion means; it has no captured mounted owner to close directly. Escape, backdrop and close-button requests therefore go to the feature. |
| `dismissed` on GameCreation, PlayerSelection, AnalysisEngineSelection, DrawResponse, EngineProfile, Confirmation, Message, NavigationMenu and Promotion modals | [ModalComposable](../src/composables/ModalComposable.ts) binds `onDismissed` to the particular opening's owner. It aborts, unmounts, removes the container and settles that opening's completion once. A component-local visible flag would leave the provider's owner alive; a close-current shortcut could close a replacement. These events are lifecycle notifications, not unnecessary domain-action relays. |
| `PromotionModal.selected(IMoveRaw)` | The receiver is the board's pending gesture, which checks membership in its actual candidate list before emitting a move. The separate dismissal reaches the modal provider; choosing a piece is not itself permission to commit a canonical move. |

`SettingsView.appearanceChanged` also stays. [App](../src/App.vue) owns document-level CSS variables, scale and theme meta elements; [SettingsView](../src/views/SettingsView.vue) emits only after successful Apply, Save or Reset. This explicit accepted-settings boundary replaced a watcher. Draft edits and rejected writes must not apply appearance, and system-theme switching stays in CSS.

## Retained props and slots: concrete justifications

| Planned retained input | Why it remains explicit |
| --- | --- |
| Feature `gameId` inputs | Identify the workspace being displayed or configured, including when a route or another modal becomes active. Resolve from the existing store; do not pass both an ID and a second full copy of the same game. Capture a real game/seat/offer before async work rather than retargeting after an await. |
| `HistoryPanel.disabled`, `AnalysisPanel.disabled` | Include `GameView`'s private playback state and its shared board/history permissions. That state is not in a store and should not be duplicated or moved into global state to save one prop. Engine startup and assignment eligibility are separately derived locally. |
| `GameControlPanel.mode`, `canTakeBack` | `mode` is the view's common classification used by the board, sidebar and paused contextual action. `canTakeBack` also incorporates the private playback lock and the current takeback count/policy. Retaining these avoids independent control eligibility that disagrees with the rendered input owner; pause eligibility and draw status do not require parent ownership. |
| `PlayerPanel.colour` | Identifies the displayed seat; the two panels have different colours and swap placement with board orientation. |
| `PlayerPanel.remainingMs`, `active` | Both strips consume one view-owned `now` timer and the actual live-turn projection. `active` deliberately follows actual play, not the side to move on the rendered historical/analysis board. Do not create a timer and a competing turn calculation per strip. |
| `PlayerPanel.capturedPieces` | Both strips use the same history traversal for the currently rendered path, grouped by capturing colour. Keeping these arrays avoids repeating that traversal and keeps them tied to the displayed position. |
| `PlayerPanel.selectionDisabled` | Carries the view's private playback lock. Board-edit eligibility is derived locally after the migration. |
| `Chessboard.position`, `boardEdit`, `inputDisabled` | Supply the canonical position, editing mode and input permission. Together with `displayPosition` and `premoveColour`, they define the actual gesture context. The current `onBeforeUpdate`/unmount boundaries clear selection, drag, touch-tap state and pending promotion when that context is replaced. An equal-looking board from another game must still replace the gesture owner. |
| `Chessboard.displayPosition` | Supplies the detached premove projection for artwork, accessible labels and projected candidate selection while `position` remains canonical for ordinary legality. These positions have different meanings and cannot be collapsed into one mutable input. |
| `Chessboard.premoveSquares` | Shares the projection's endpoint set for red highlighting, touch cancellation eligibility and whether completed intentions exist to cancel. Use the supplied set directly; do not clone it or derive it from the canonical board, which contains no queued intentions. |
| `Chessboard.premoveColour` | Identifies the eligible off-turn local colour. It selects premove candidate generation and the selectable colour rather than the canonical side to move; changes also replace the gesture context. The board cannot derive this permission from canonical piece placement alone. |
| `Chessboard.orientation`, `showCoordinates`, `highlightLastMove` | These are the three board-rendering choices supplied by the accepted appearance settings. They do not define game identity or clear a gesture by themselves; explicit inputs preserve that distinction. |
| `Chessboard.lastMove?: IMove` | Feeds both highlights and `genLegalMovesForPiece`; the legal query uses historical move facts. Reducing it to highlight coordinates would break that second consumer. See the existing raw-move retention audit. |
| `ChessPiece.kind`, `colour`; `AppIcon.name` | Direct drawing inputs used by board, player, modal and navigation surfaces. They cannot be derived from a single global game because these surfaces render multiple pieces, colours and icons simultaneously. |
| `GameCreationModal.gameId?` | Omitted means create a new workspace; supplied means start the prepared game. It is an action target and a real form-mode distinction. |
| `PlayerSelectionModal.colour` | Selects the white or black seat within the identified game. |
| `EngineProfileModal.engine?`, `index?` | The engine seeds a private editable form. The index selects an existing draft entry to replace. Settings Copy passes a new seeded engine with no replacement index, while Edit passes both; deleting either input would conflate those existing flows. Settings route hooks close this editor before a route/category change. |
| `PromotionModal.moves`, `colour` | `moves` are the exact pending raw candidates for legal play or premoves; the board validates candidate identity on selection. Raw moves contain no moving colour, so the separate colour is necessary for the piece artwork and accessible labels. |
| Modal `signal` | The provider supplies the opening's abort lifetime and consumes dismissal. Async modals use it to block late UI delivery/navigation. Message and NavigationMenu still declare this injected prop so the uniform mount contract consumes it rather than forwarding an `AbortSignal` as a native root attribute; their unmount already ends their local work. |
| `ModalDialog.title`, `subtitle`, `wide`, `dismissible` | Supply accessible naming/context, the wide game/engine forms, and actual dismissal restrictions. Confirmation and DrawResponse use different restrictions; the shell cannot infer them from its content. |
| `ConfirmationModal.title`, `subtitle`, `message`, `confirmLabel`, `cancelLabel`, `danger` | Existing continuation, resign/draw, settings reset/discard and save overwrite/delete callers supply different copy and consequences. `cancelLabel` is used for Keep editing; `danger` selects destructive confirmation styling. These are independent used variants, not forwarded game state. |
| `ConfirmationModal.confirm(signal)` | Must be awaited so the modal owns busy/error/retry feedback and closes only after settlement. Vue does not await an async emitted listener, so replacing this callback with an emit loses its required completion semantics. |
| `ConfirmationModal.dismissibleWhileWorking` | Save overwrite explicitly sets false so dismissal/focus restoration waits until the save owner releases its working state. Other confirmations permit cancellation and suppress late UI delivery through their signal. |
| `MessageModal.title`, `subtitle`, `message`, `closeLabel`, `error` | Timeout and blocked-edit acknowledgements use different close labels; import failure selects error presentation. These values describe the specific notification and cannot be inferred inside a shared message shell. |
| `NavigationFrame` brand/default/footer slots; `NavigationMenuModal.content` | Game, library and settings supply different actions, including library file operations and settings dirty-exit checks. The drawer renders those same slot functions with their existing closures; rebuilding their state or callbacks as new props would duplicate their owners. |

## Publication, action and lifecycle boundaries

Games use the existing workspace collection's canonical reactive objects, as implemented in the [counter removal](ArchivedPlans/WorkspaceRevisionRemovalPlan.md). Moved computed projections read the fields and arrays their templates use; history traverses reactive children and paths, and analysis renders reactive seats and shallow-reactive runtime status. No revision prop, publication helper, timestamp dependency or clock tick drives these updates. Preserve exact raw premove references in the shallow-reactive queue array.

Keep these owners explicit during implementation:

- `GameView`: rendered snapshot/input actions, canonical/premove display distinction, off-turn board/PV routing, captured premove-cancellation action, playback `OperationOwner`, pending historical continuation, clock timer/timeout notification, Menu interruption and route activation.
- History/Analysis panels: their own fold actions and feedback; `UiStateStore` remains the persisted layout owner. Analysis also coordinates assignment removal with the matching fold entry.
- GameTabs/MenuBar: tab and quick-game actions, including close-only cancellation of the target game's queue before closing its tab. Temporary switching preserves queues; router hooks still own committed navigation effects. Preserve the five Menu-interruption events rather than duplicating their private resources.
- Mounted modals: editable form and async UI delivery; the provider alone owns mounted-container replacement and exactly-once completion. `dismissed` always targets the captured opening.
- Stores/domain: canonical mutations, move legality, turn scheduling, engine resources, clocks, autosave and serialization. Local UI handlers call these existing boundaries.

Local failures remain visible in the initiating feature using the existing global feedback classes. A moved action must retain its pending/abort owner until settlement and must not report success, navigate or close another opening after disposal. Do not replace a removed event with an equivalent function-prop relay.

## Implementation sequence and verification

| Step | Deliverable | Required evidence |
| --- | --- | --- |
| COMP-01 | Remove unused icon option and duplicated player/analysis/draw modal inputs. | Existing chooser behaviour; seeded current-player choice; exclusion of assigned empty/restored engines; draw response uses the opening's offer and refuses a missing/replaced offer before submission, without claiming stronger store-level identity protection; all direct modal callers migrated. |
| COMP-02 | Merge the creation form and extract the small modal execution helper. | Fresh form on every opening; create/setup validation; engine validation failure and retry; duplicate-submit prevention; replacement/unmount suppresses late navigation/errors; actual domain mutations retain their completion semantics. |
| COMP-03 | Move tabs, quick creation and close actions; remove dead menu capability/deletion API. | Real button tests for selecting, closing current/background/final tabs, unchanged ordering/fallback, rejected navigation, and identical quick defaults from Home/MenuBar. PRE-S19 retains its two-game assertions: switching preserves queues, close clears only the target queue before tab removal, and actual turns are not disposed. Menu route/custom actions still pause/resume only the captured Menu owner. |
| COMP-04 | Move history/analysis projections, folds and engine management. | Layout restoration/save failures; removal reconciles the right fold; paused engine management and board-edit startup restrictions; evaluation-only rendering; in-place reactive mutations update rows/seats without a clock tick. PRE-S15 preserves due-turn first-move, off-turn clicked-local-only and explicit-analysis prefix routing, including raw entry identity. Live-position and row selection both cancel playback/continuation through the retained event. |
| COMP-05 | Move player chooser and the six independent control flows. | Both colours/orientations; shared clock/capture display; chooser available during pause but disabled during playback/editing; manual resume preserves other pause owners; resignation/live colour, draw handoff and setup actions unchanged. Retained input callbacks reject replaced rendered contexts. |
| COMP-06 | Reconcile implementation docs and run the relevant checks. | Remove stale `NewGameModal` references; update component/event contracts, SharedDialogFlows and InteractionMap to match the final owners. Record results and any independent existing failures separately. |

Adapt existing tests to user-visible actions when an emit is intentionally removed. Existing tests that manually emit `tabClosed`, engine management or player-selection events must no longer pretend those are public APIs. PRE-S19 must exercise real tab buttons and retain its two-game queue-identity assertions. Retain direct coverage of the intentionally preserved raw-input, premove cancellation, off-turn PV and continuation boundaries. Do not replace meaningful behaviour tests with assertions that only count props/events.

Use the existing component/view suites under `src/components/**/__tests__` and `src/views/__tests__`, `UiStateStore.spec.ts`, all PRE-S01-PRE-S25 tests, and the mounted journey tests for the changed flows. Add focused cases only where the moved ownership or failure/cancellation behaviour is not already exercised. Browser acceptance should cover affected `fresh`, `setup`, `play`, `analysis`, `history`, premove, `clocks/Menu`, `settings`, session-tab and usability dialog/keyboard journeys, with one worker and no retries on this host.

Before implementation, establish a fresh unit/application baseline on the current source and record its commit, command and results. The archived [reactivity verification](ArchivedPlans/WorkspaceRevisionRemovalPlan.md#implementation-evidence---23-october-2026) records **866/866 tests across 98 files**, including all PRE-S01-PRE-S25 cases; the later [store reflow verification](ArchivedPlans/StoreDependencyRestructuringPlan.md#verification-results) records **206/206 affected tests and 25 selected browser journeys**. These are historical reports, not tests executed by this review or substitutes for a fresh baseline. Resolve or explicitly document any independently reproduced pre-existing failure; there is no blanket exemption for premove failures.

For implementation changes, run `npm run check:code`, the relevant unit/mounted tests, `npm run type-check` and `npm run build`, followed by the focused browser acceptance. Treat new premove failures as regressions and preserve their existing contracts. Check local Markdown links and `git diff --check` for the documentation changes.

Acceptance requires the retained events to still cross their documented owner boundary, all other reviewed relays to have the named local owner, and the retained props to have their stated consumer. The numerical reductions alone do not establish correctness.

The original review and the following documentation correction checks are historical evidence from before implementation. Correction verification on 23 October 2026: `npm run check:code` passes; all 38 local links, including heading targets, resolve; a TypeScript AST comparison confirms the current counts for all 21 component rows and reconciles the totals to 85/51 current and 63/28 planned props/events; `git diff --check` passes for this document. No application unit tests or browser acceptance were run for this documentation correction.

## Implementation record — 24 October 2026

COMP-01 through COMP-06 are implemented. The inventory above now records the actual interfaces: **20 components, 63 props and 28 events**, removing one component, 22 props and 23 events from baseline `24ebd15`. The retained-input and retained-event tables remain the justifications for the final interfaces.

- Player, analysis and draw choosers resolve their own canonical state. DrawResponse captures the real offer, refuses a replaced offer and dismisses through its update lifecycle; the existing store acceptance limitation described above remains unchanged.
- GameCreationModal owns its form and submission. NewGameModal and its create/cancel relay are removed. `useModalAction` shares duplicate-submit prevention, busy/error feedback and opening-lifetime checks across the five asynchronous feature modals.
- GameTabs and MenuBar own selection/close and quick creation through `useGameTabActions` and `useQuickGame`. Switching publishes selection only after route commitment. Closing clears only the closing game's premoves before tab removal and retains the canonical game and turn. Home and Menu use the same accepted quick defaults; route changes cancel late quick-game UI delivery.
- HistoryPanel owns reactive tree/path projection and persisted collapse actions. AnalysisPanel owns reactive seats, folds and engine management, resolving captured seat identity before each action and reconciling the removed seat's fold before asynchronous cleanup settles. Both display local failures.
- PlayerPanel opens its chooser. GameControlPanel owns pause/resume, board editing, setup start, resignation and draw negotiation through existing public store APIs. GameView retains the documented rendered-input, playback, continuation, clock and Menu-interruption owners. Chessboard and its premove interface are unchanged.
- Component/view contracts, shared dialog flows, the interaction map and affected scenario/process documents now identify these owners. Tests exercise the real moved controls; PRE-S19 switches and closes real tab buttons while retaining both games' queue-identity assertions. Additional cases cover quick-game defaults/cancellation, rejected selection, tab closure, reactive engine exclusion, obsolete draw responses, fold-save failure/removal and creation failure/retry/duplicate submission.

### Executed verification

- Fresh baseline on `24ebd15`: **867/867 unit/application tests across 98 files passed**. The implementation's full run passed **877/877 across 99 files**, including the existing premove and background-analysis suites. Both used portable Node with `node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads --testTimeout=90000`. The final run took 150.46 seconds and exited successfully.
- Browser acceptance covered **161 distinct cases**, one worker, no retries: Fresh, Setup, Play, Analysis, History Navigation/Rewrite/Pause, Clock Menu, Settings Navigation/Assignment/Inventory, Usability Dialog/Keyboard, all four sessions and engine-race Premoves. The first run passed 160 and exposed one obsolete session clock assertion. An isolated copy of unchanged `24ebd15` reproduced the identical failure: Black had 270 seconds after 30 seconds of exploration, rather than the expected frozen 300. JRN-SESSION-01 now asserts the existing background-clock contract and 268 seconds after the next actual move; the complete corrected session passed. No product clock behaviour was changed.
- `npm run check:code` and `npm run build` passed; the build includes the full TypeScript checks and production bundle. Source AST inspection confirms the inventory totals. All 118 local Markdown links/heading targets in 27 changed documents resolve, and `git diff --check` passes. Unrelated engine-planning edits are outside this verification.

Ignored execution evidence is under `node_modules/.tmp/component-simplification/`: `UnitVerificationSummary.json` records the observed baseline/final successful runner output; `InitialBrowserResults.json`, `BaselineSessionResults.json` and `FinalSessionResults.json` preserve the browser runs; `SourceChecks.json` and `DocumentationChecks.json` record interface and documentation checks. Playwright cleared the initial unit JSON files in its default output directory, so the unit summary does not claim to be a detailed runner report.

Browser journeys use their existing scripted engine boundary. Native NW.js/installed-engine acceptance was not run. The independently reproduced session expectation was corrected as described above; no premove failure was exempted.
