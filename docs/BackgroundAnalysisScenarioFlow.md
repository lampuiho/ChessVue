# Background analysis: function flow for every scenario

Draft replanned on 21 October 2026. Read with the [main plan](BackgroundAnalysisPlan.md), [paused-entry decision and breakage audit](questions/play/Q-PLAY-003-PausedAnalysisEntry.md) and [product decisions](questions/play/Q-PLAY-002-PremoveAnalysisConflicts.md). **Documentation only; implementation and retained-test edits still require written-plan approval.** After approval, write/revise unit specifications and observe meaningful failures before production changes.

The arrows below name existing functions, including private functions. `View`, `Move`, `Position`, `Status`, `Clock`, `Turn`, `Analysis` and `Workspace` abbreviate their existing GameView/composable owners. Store calls keep the current GamesStore facade. No arrow proposes a new public API, enum, model field, turn driver or watcher. Private view composition may reuse existing actions without changing component props/events.

## Shared branch rules

These are the exact conditions reused in the scenario paths, not additional stored state:

1. **Following live:** `game.renderedPath === game.livePath`. Equal array contents alone do not establish following. Position getters alias caches only for the shared reference; explicit analysis hydration preserves separate references even at equal values.
2. **Actual readiness:** change existing `Status.isLiveTurnReadyForMove` to require ongoing result, a live path and an unpaused ordinary-live or explicit-analysis state. No selected-path equality. Real paused states remain unready. Existing turn ownership prevents duplicate starts.
3. **Exploration:** explicit analysis is identified by existing game state, not by `PauseReason.Analysis`, panel mode or path inequality. An analysis input cannot resolve the actual deferred turn. Ordinary review does not enter Analyse implicitly.
4. **BA-Q4 remains pending:** if paused exploration is allowed, `canExploreAnalysis` includes paused explicit analysis and existing move/navigation assertions use that permission. If not, paused analysis moves/history remain disabled and reject before mutation. Either way, paused entry/Exit work, actual play stays paused and actual Takeback/result actions keep their pause guard. Both branches are specified below; neither is inferred approved.
5. **Entry/Exit ownership:** capture pause status before changing state/path. Preserve clock snapshot, pause reasons, actual pending promise/controller and held reply. Entry/Exit never call clock pause/resume or deferred flush. Only final real Resume delivers held output.
6. **Actual result:** ongoing commits preserve explicit-analysis versus ordinary-play/review family. A terminal result selects the appropriate existing non-live analysis state for the selected board. Return to the final actual node uses its side-to-move analysis state, preserves result and never restores a live state.
7. **Pruning:** before an actual commit, skip `pruneFutureMoves(liveParent)` when `Position.isPathPrefix(game.livePath, game.renderedPath)` shows it would delete selected descendants. Otherwise keep the existing current-move policy. Once actual progression leaves the anchor behind, keep its analysis branch as history; no Exit/navigation cleanup.
8. **Selected input:** reuse the existing private `renderedBoard` projection as the input owner. Its reuse comparison includes game/node/FEN, explicit-analysis/input permission and ongoing-versus-terminal result phase. Actual-colour changes or score publications alone do not replace unchanged analysis input. Mode/node/game/permission/result changes do. Existing Chessboard position-prop reset clears transient input. User/lifecycle actions cancel view playback explicitly; a background result invalidates its context, and the existing delayed loop stops before its next commit. Keep computed derivations pure and add no observer/callback API.
9. **Permissions stay separate:** `assertOngoingLiveAction` retains ordinary-live/result-action restrictions even though actual readiness also accepts analysis. Actual Takeback uses its own genuine-pause check rather than inheriting permission from a widened exploration assertion.
10. **Paused controls without API changes:** retain existing paused control mode and its Resume action. GameView composes one contextual Analyse/Exit action in the same controls region, selected from existing game state and calling existing actions. Reuse current global button classes. Do not reorder mode precedence to hide Resume, add a mode/prop/event, or repurpose an unrelated prop to encode pause state. Normal unpaused controls remain in GameControlPanel.

Test lanes: **U** data-driven store/position unit tests with controlled external callbacks; **V** mounted view/board tests; **J** affected existing journey/browser regressions. These paths are plans, not executed acceptance.

## Entry, selection and actual progression

### BA-01

**Current-node entry and repeated entry — U,V**

`Analyse event -> playback.cancel() -> enterInGameAnalysis -> getRenderedNode/getRenderedPosition + getLivePosition -> genPosition(selected, []) -> setRenderedPath(copied path, selected cache) -> getLiveAnalysisState(actual colour, selected colour, captured pause status) -> _publishRenderedPosition(game, false)`.

Gate the ongoing branch on live-path availability and the existing ordinary-live/paused-live families; unsupported setup/edit context does not enter live analysis. Existing explicit analysis returns without another transition. Terminal entry follows BA-19's post-result branch. Clear pending historical-confirmation UI at the view boundary. Do not invoke `pauseGame`, `resumeGame`, `clearPlayerTurnRuntime`, `flushDeferredPlayerMove` or `_requestPlayerMove`. Input context changes even if node/FEN do not. Actual search and clock ownership survive.

### BA-02

**Equal-path entry followed immediately by an actual reply — U,V**

`BA-01 -> existing engine callback -> Turn.attemptPlayerMove -> resolve current deferred -> _playerMoveHandler -> commitLiveMove -> _applyLiveMove -> _finaliseLiveMove -> requestPlayerMoveIfNeeded`.

`getRenderedPosition/getLivePosition` must preserve the detached caches before the first analysis move. `commitLiveMove` reads reference identity as false, advances only live path/position and publishes with selected-position `changed = false`. Explicit state updates actual colour without changing selected colour/node/board. No first exploratory move is needed to establish isolation.

### BA-03

**Explicit Analyse from history with either Takeback setting — U,V**

`View._navigateToNode -> Move.navigateToNode -> selected historical node -> Analyse -> BA-01 on that node -> View._makeMove/_playAnalysisLine -> _requestMoves -> _applyMoves -> makeMove -> assertMoveAllowed -> _commitLiveAnalysisMove -> _advanceRenderedAnalysisBranch -> addAnalysisMove/setRenderedPath -> _publishRenderedPosition`.

View checks explicit analysis before creating `pendingContinuation`; Move checks it before historical rewrite. Both Takeback settings therefore explore the selected canonical position without rewrite confirmation, actual move/increment, actual result update or actual deferred resolution. Paused input follows the two BA-Q4 branches; entry itself is allowed in both.

### BA-04

**Ordinary root/mainline/sibling/nested review during actual play — U,V,J**

`HistoryPanel node event -> View._navigateToNode -> playback.cancel() -> Move.navigateToNode -> assertExplorationAllowed -> isNodeInTree -> getPathToNode -> setRenderedPath -> getLiveState(actual colour) -> _publishRenderedPosition(game, changed)`.

Capture whether explicit analysis was already active before selection; this case was ordinary review, so do not choose an analysis state. Selected-position change refreshes selected evaluation. Independently, actual callback follows BA-02's actual chain and preserves the selected node. Actual clock remains running; Manual/Menu still blocks ordinary review navigation. Input follows confirmed rewrite permission, not implicit exploration.

### BA-05

**Navigate inside Analyse and deliberately return to live — U,V**

`HistoryPanel -> _navigateToNode -> playback.cancel() -> navigateToNode -> membership/permission -> setRenderedPath -> getLiveAnalysisState(actual colour, selected colour, captured pause status) -> _publishRenderedPosition`.

Selecting an independent analysis/history node preserves explicit mode. The deliberate Live-position action follows `_returnToLivePosition -> navigateToNode -> _returnToLiveNode`; Exit follows `exitInGameAnalysis -> _returnToLiveNode`. The helper restores shared live references and chooses paused/live/terminal state as in BA-06. If BA-Q4 rejects paused history navigation, its history action stays disabled; explicit Exit remains available and preserves the actual pause.

### BA-06

**Exit before/after a reply, repeatedly, or during a genuine pause — U,V**

`Exit -> playback.cancel() -> exitInGameAnalysis -> capture paused/result context -> _returnToLiveNode -> getLiveNode/getLivePosition -> setRenderedPath(game.livePath, live cache) -> choose state -> _publishRenderedPosition`.

For an ongoing paused game choose `getPausedState(actual colour)`; for ongoing unpaused choose `getLiveState(actual colour)`; for terminal choose `getAnalysisState(final selected colour)` and preserve result. Only the ongoing unpaused branch may call `requestPlayerMoveIfNeeded`; its existing ownership gate normally makes this a no-op. Never flush or resume here. A repeated/stale Exit without explicit mode does nothing. A reply arriving later still belongs to the original actual owner.

### BA-07

**Pruned, detached or foreign navigation target — U,J**

`retained HistoryPanel event -> navigateToNode -> assertExplorationAllowed -> isNodeInTree -> false -> return`.

Do not derive a path or change selected/live caches before membership succeeds. Test stale parent links and nodes from another hydrated tree as well as removed descendants. Normal view cancellation can clear unfinished input, but game tree/clock/result and actual turn ownership stay unchanged.

### BA-08

**Ordinary following-live move and intentional detach/reattach — U**

`View._makeMove -> _requestMoves -> _applyMoves -> makeMove -> ordinary current-position/Local-player permission -> attemptPlayerMove -> _playerMoveHandler -> commitLiveMove -> _applyLiveMove -> appendLivePath -> _finaliseLiveMove`.

While references are shared, append live path once; selected path/cache follows that same mutation and selected evaluation refreshes. Navigation detaches through BA-04. Return reattaches through BA-06; the next actual append again advances both. No API or extra selector owner is introduced.

### BA-09

**Interleaved actual and exploratory moves for different colours — U**

`analysis board/PV -> makeMove -> _commitLiveAnalysisMove -> _advanceRenderedAnalysisBranch` and, separately, `engine result -> attemptPlayerMove -> _playerMoveHandler -> commitLiveMove -> _finaliseLiveMove`.

Exploration applies only to selected position/path and selects `getLiveAnalysisState(current actual colour, resulting selected colour, pause status)`. Actual commit updates actual clocks/history/result and retains selected branch. Run both arrival orders. Exploratory mate/check/capture cannot be treated as actual result or captured material; selected evaluation remains canonical.

### BA-10

**Actual human turn arrives with Analyse displayed and no queue — U**

`actual engine reply -> commitLiveMove -> _finaliseLiveMove -> requestPlayerMoveIfNeeded -> _requestPlayerMove -> due Local player -> existing deferred waits`.

No engine provider starts for this Local turn. Analysis moves take BA-09's selected route and never settle that actual deferred. Actual clock runs and can time out via BA-19. Exit reattaches selection without resolving the deferred; only a fresh allowed actual board move after return settles it. No human premove implementation is smuggled into this prerequisite.

### BA-11

**Three successive engine-engine turns behind analysis or review — U**

`controlled result -> attemptPlayerMove -> _playerMoveHandler finally releases current runtime fields -> commitLiveMove -> _finaliseLiveMove -> requestPlayerMoveIfNeeded -> _requestPlayerMove -> ensureReady/startPlayerTurn -> next controlled result`.

Repeat at least three replies in explicit-analysis and ordinary-review fixtures. Readiness uses actual unpaused game state and live path, not rendered equality. Existing pending-owner check prevents duplicate starts. Exactly one actual move per result; no Exit is required and selected board stays fixed. Genuine pause diverts to BA-14, terminal result stops at BA-20.

### BA-12

**Actual elapsed time, increments and turn display — U,V**

`actual commit -> commitLiveMove.reconcileTimeout -> _applyLiveMove -> Clock.applyMove -> TimeControlService.applyMove -> addMainlineMove(clock snapshot) -> appendLivePath -> _finaliseLiveMove -> refreshRuntimeRegistrations`.

Use explicit timestamps for zero/+2 increment and both actual colours while selected colour differs. Apply one increment to the actual mover; neither analysis moves nor entry/Exit calls this clock path. Existing GameView remaining-time derivation reads actual snapshot; actual-turn/status bindings read live side, while analysis board/last move/captures remain selected-board derivations.

## Pauses, navigation and results

### BA-13

**Paused entry and Exit with pending or already-held output — U,V,J**

`paused Analyse action -> playback.cancel() -> enterInGameAnalysis -> accept isPausedLiveState -> capture paused = true -> detach selected position/path -> getLiveAnalysisState(actual colour, selected colour, true) -> _publishRenderedPosition(game, false)`.

Preserve actual clock snapshot, Manual/Menu set, pending promise/controller and existing `deferredPlayerMove`. An in-flight result takes `_playerMoveHandler -> isPausedState -> deferredPlayerMove`, with no commit. Paused Exit takes BA-06's `getPausedState` branch and never flushes/arms. The controls region shows Resume plus the contextual Analyse/Exit action using existing events/store calls. Repeat with Manual, Menu and both. Removing only the old assertion is insufficient: the entry state-family condition must also accept paused live play.

### BA-14

**Paused explicit analysis, input and evaluation — U,V,J**

`Pause -> Clock.pauseGame -> reconcile existing expiry -> add actual pause owner -> pauseClock -> matching PausedLiveAnalysisFrom state -> refreshRuntimeRegistrations/touchGame`; actual output then follows `_playerMoveHandler -> deferredPlayerMove` and evaluation follows `Analysis subscription callback -> seat update -> touchGame`.

BA-Q4 yes: `makeMove -> assertMoveAllowed/canExploreAnalysis -> _commitLiveAnalysisMove`, and history uses `assertExplorationAllowed -> navigateToNode`, preserving paused actual state. BA-Q4 no: disable those view actions and reject before selected mutation. Both variants keep actual moves, Takeback, draw/resignation and board edit blocked, retain held output and allow existing evaluation/management. Do not broaden `assertNotPausedForAction` globally.

### BA-15

**Layered real pauses and final Resume while analysis stays selected — U,V,J**

`Resume(owner) -> Clock.resumeGame -> ongoing/paused checks -> remove only owner -> remaining owners? touchGame and return : resumeClock -> getLiveAnalysisState(actual colour, selected colour, false) or getLiveState(actual colour) -> refreshRuntimeRegistrations/touchGame -> flushDeferredPlayerMove -> requestPlayerMoveIfNeeded`.

A non-final removal never calls flush and preserves the same held reply. On final removal, existing readiness must allow unpaused analysis. Flush consumes once and commits through BA-02; final request is no-op if that commit already armed the successor. If no reply is held, retain the in-flight owner or arm one eligible missing turn. Repeated Resume after unpausing returns immediately. The Resume control remains reachable without Exit; selected analysis board stays isolated.

### BA-16

**Menus, cancellation, disabled auto-pause and untimed play — U,V,J**

`View._handleMenuInterruptionRequested -> playback.cancel() -> existing autoPauseOnMenu/timed policy -> pauseGame(Menu) when eligible -> existing router/modal action -> _handleMenuInterruptionCompleted -> resumeGame(Menu)`.

Custom cancellation uses the existing modal completion callback only for its interrupted game; route activation completes its own Menu pause on return. Manual owner remains until explicit Resume. Enabled real pauses use BA-14/15; disabled auto-pause leaves actual time/work running; untimed play does not acquire a synthetic Analysis/Menu pause merely because analysis was entered. Menu overlay focus/route rules remain intact; paused-entry permission does not bypass an active modal.

### BA-17

**Game switch, route teardown, return and tab close — U,V,J**

`_selectTab -> UiStateStore.setActiveGame -> router.push -> existing route hooks -> playback.cancel -> _activateGame -> clear pendingContinuation -> destination lookup -> _handleMenuInterruptionCompleted(destination)`.

Unmount follows `playback.dispose` and removes view-owned timers/listeners. Per-game actual state and independent selected branch stay in GamesStore; tab switch alone does not pause actual time. `_closeTab -> UiStateStore.closeTab -> router.push` removes the session tab only: it does **not** invoke game/engine disposal in current code. Preserve that existing actual-game lifecycle in this prerequisite; do not invent a dispose/remove-game API. Future queue cancellation on explicit close remains a premove concern.

### BA-18

**Pause/Resume and allowed actual controls from opposite-colour review — U,V**

`ordinary review -> pauseGame(Manual) -> getLivePosition.sideToMove -> getPausedState(actual colour)`; `resumeGame(Manual) -> actual clock resume -> getLiveState(actual colour) -> final-owner delivery`.

Permitted ordinary-review draw actions use `assertOngoingLiveAction -> getLivePosition -> existing offer/accept/decline/withdraw flow`; resignation modal captures the actual side instead of rendered side. Paused/explicit-analysis restrictions remain. Historical selected-side changes cannot transfer actual clock/control ownership. Configuration changes use BA-24, not result-action permission.

### BA-19

**Exact expiry, held reply and concurrent clock reconciliation — U,J**

`View._reconcileTimeout / focus callback / actual move boundary -> syncClock or reconcileTimeout -> existing expiry test -> syncClock reuses pending timeout settlement -> _settleTimeout -> clearPlayerTurnRuntime -> _finaliseTimeout -> pause actual clock -> result/state -> touchGame/refreshRuntimeRegistrations`.

Keep the existing authoritative timestamp and pending-settlement ownership; no new timer or invalidation counter. A reply after cancellation cannot commit, and a move at expiry gains no increment. Keep selected surviving board for non-live analysis and existing one-per-timeout notification. Exit/Return selects terminal actual board via BA-06; stale Resume/result callbacks do not restore ongoing state. A supported post-timeout `enterInGameAnalysis` request may detach selected references for review and publish the selected analysis state, but never changes result, resumes a clock or arms an actual turn. Other finished workspaces retain their ordinary post-result analysis path. Valid paused entry does not start time or bypass result checks.

### BA-20

**Actual mate or rule-resolved draw behind another selection — U,V,J**

`actual result -> commitLiveMove -> _applyLiveMove -> _finaliseLiveMove -> updateGameResultFromLivePosition(actual position) -> stopped actual clock + live-node clock snapshot -> getAnalysisState(selected side) -> _publishRenderedPosition(selected unchanged) -> refreshRuntimeRegistrations -> requestPlayerMoveIfNeeded returns ineligible`.

The selected protected branch survives and is now non-live review. No successor engine starts. The changed result/input context makes the delayed playback loop return before its next commit; existing user/lifecycle boundaries still cancel/settle it explicitly. Do not invent a store-to-view callback or watcher to cancel immediately at a background result. Later fresh ordinary analysis preserves result. Returning to final actual node never selects `Live*Turn`.

### BA-21

**Exploratory mate/draw and forbidden actual result actions — U,V**

`analysis move -> _commitLiveAnalysisMove -> _advanceRenderedAnalysisBranch -> applyMove/addAnalysisMove -> update explicit selected state -> _publishRenderedPosition`; no `updateGameResultFromLivePosition` call occurs on this path.

Direct `resignGame/offerDraw/acceptDrawOffer/declineDrawOffer/withdrawDrawOffer` still go through `assertOngoingLiveAction`, which rejects explicit-analysis/paused contexts independently of actual readiness. View hides these actions. Board-edit entry retains its existing live-path block, including after results. No exploratory checkmate or fifty-move/draw fact ends actual play.

## Structural actions and unfinished input

### BA-22

**Actual Takeback, move-count policy and invalid selected branch — U,V,J**

`Takeback -> playback.cancel() -> takeBack -> genuine-pause guard -> existing allowTakeback/count checks -> target getLiveNode for live workspace -> clearPlayerTurnRuntime -> stop actual player engines -> MoveHistoryService.takeBack -> getPathToNode -> setRenderedPath/setLivePath -> restore actual clock with startClock(now) -> select existing live state -> _publishRenderedPosition -> refreshRuntimeRegistrations/requestPlayerMoveIfNeeded`.

Remove Analysis re-pause. Human-engine count includes the human's last move plus any reply; thinking cancels only the pending reply and rewinds the human move; an engine opening alone offers no rewind. Hotseat/non-live count remains existing policy. Disabled, no-move and genuinely paused cases return/reject before cancellation/mutation. Never use widened `assertExplorationAllowed` to authorise actual paused Takeback. Selected removed branches and their playback cannot survive the actual tree change.

### BA-23

**Existing historical rewrite: cancel, confirm and stale confirmation — U,V,J**

`ordinary historical move/PV first move -> _requestMoves -> ongoing + unpaused + not explicit Analyse + historical prefix + allowTakeback -> pendingContinuation`; Cancel clears only that UI intent.

`_confirmContinuation -> recheck game/node, ordinary context, ongoing result and permission -> _applyMoves -> makeMove -> historical branch before ordinary-live submission -> _commitHistoryRewriteMove -> clearPlayerTurnRuntime -> recheck that actual settlement did not end play -> set actual selector/cache to selected anchor -> startClock(selected historical snapshot, now) -> _applyLiveMove -> _finaliseLiveMove`.

Cancel/stale selection/mode/result changes never call the actual rewrite. Entry, route changes and navigation clear obsolete pending confirmation. If actual play advances while the same valid historical anchor remains selected, confirmed rewrite deliberately replaces the then-current actual continuation under the same existing policy; retain played history as variation. Never use normal latest-node pruning in rewrite. With Takeback disabled, keep input blocked until Analyse; explicit analysis bypasses confirmation in both View and Move.

### BA-24

**Player reassignment, none conversion and no-op — U,J**

`player selection -> existing confirmation -> reassignPlayer -> createPlayerSnapshot -> schema comparison -> unchanged? return : clearPlayerTurnRuntime -> stop old actual player engine -> replace the selected seat`.

Read actual colour from `getLivePosition` when a live path exists, even in ordinary review. If both players remain assigned, preserve current actual pause/state family and clock; publish and request only when eligible. If either becomes none, follow existing conversion: pause/materialise actual clock, clear live path/pause/result/draw fields, preserve selected board/tree and choose non-live analysis. Old aborted output cannot mutate replacement. Another game's owners remain untouched.

### BA-25

**Setup/root replacement and actual resource teardown — U,V,J**

`startGameFromSetup -> disposeAnalysisForGame -> clearPlayerTurnRuntime -> await captured cleanup -> existing player/seat/time-control replacement -> _startLiveGame or non-live state -> touchGame/refreshRuntimeRegistrations -> requestPlayerMoveIfNeeded -> refreshAnalysisForGame`.

Direct free-board edit uses `enterBoardEdit -> existing live-path/paused guards -> stopAnalysis`; effective edit follows `_applyEdit -> replaceWithAnalysisRoot -> replaceMoveTree -> setRenderedPath/setLivePath -> publish`. It is not a back door from a live/paused-analysis workspace. Cancel view playback before replacement. Resource teardown uses existing subscription disposal/stopEngine at its actual owner; late callbacks cannot mutate the replacement. Tab close is BA-17, not a nonexistent game-disposal workflow.

### BA-26

**Stale PV suffix and valid prefix playback — U,V,J**

`AnalysisPanel moveSelected -> _playAnalysisLine -> explicit/non-live exploration? full selected prefix : first move -> _requestMoves -> _applyMoves -> genPosition(selected, []) -> validate/apply every preview move -> playback.run -> makeMove(first) -> abortableDelay -> ownership/path check -> next makeMove`.

Validate the entire chosen prefix before the first mutation; stale later move rejects the whole request. Explicit mode routes each committed prefix move through `_commitLiveAnalysisMove`; free/terminal analysis uses `_commitStandaloneAnalysisMove`. No actual clock/result/deferred mutation. Respect the existing move-visibility preference. Paused playback follows BA-Q4; do not use an obsolete Analysis pause reason as its mode test.

### BA-27

**Delayed playback across action boundaries — V,J**

`Exit / selected-node navigation / mode switch / allowed Takeback / confirmed rewrite / root replacement / route teardown -> await playback.cancel() -> existing action`; unmount calls `playback.dispose()`.

Capture the selected input context for delayed events and verify it through the existing owner, not a new epoch/token. Before every delayed commit, retain the existing game/path checks and check current result/mode/input permission against the operation's context. No remaining delayed move lands after replacement. For Pause: BA-Q4 no cancels analysis playback before input locks; BA-Q4 yes may keep a valid explicit-analysis prefix because only actual play paused and selected permission/context is unchanged. Ordinary live input always locks on pause. A background reply/score preserves selected analysis playback; a terminal result changes context and stops its loop before another commit. No observer or computed side effect is introduced.

### BA-28

**Drag/promotion, selected-context reset and irrelevant publications — V,J**

`board gesture -> Chessboard selection/legal moves/pendingPromotionMoves`; only chosen promotion emits a complete `moveAttempted -> _makeMove -> normal routing`.

`mode/node/game/input-permission change -> View.renderedBoard replaces selected input owner/position prop -> existing Chessboard external-prop reset -> clear transient gesture/promotion`; rejected old-context view callbacks cannot become fresh input. If actual progression/score leaves selected analysis context unchanged, reuse `renderedBoard` and preserve unfinished selection/promotion. Resume changes input ownership only when permission changes. No new watcher, game flag or component event is required.

### BA-29

**Suggestion preference and live/review/analysis routing — U,V,J**

`gameplayOptions.showLiveAnalysisMoves -> View.showAnalysisMoves -> AnalysisPanel target visibility -> _playAnalysisLine -> _requestMoves -> _applyMoves -> makeMove`.

Score-only live workspaces keep evaluation without targets. With targets enabled: normal current live input submits first move to the actual Local turn; ordinary history with Takeback allowed opens BA-23; disabled Takeback requires Analyse; explicit Analyse applies selected prefix via BA-26. A human cannot use suggestions to submit an engine-owned actual colour, and no off-turn premove append exists in this prerequisite. Paused exploratory targets follow BA-Q4 while real actual commits stay blocked.

### BA-30

**Hotseat handoff and retained prior-context events — U,V,J**

`allowed actual Local move -> attemptPlayerMove -> commitLiveMove -> new actual side + selected input owner`; fresh due-side board input follows BA-08, and fresh Analyse follows BA-01 for the current context.

A retained click/drop/Analyse callback owned by the old view context is rejected at the view boundary; `makeMove` also rejects a move for a non-current side. The public `enterInGameAnalysis(game)` signature contains no person/side identity: a fresh valid invocation always refers to the current selected game context. Do not claim it can authenticate which person clicked or distinguish an unlabelled raw invocation from a fresh due-side request. No previous-side queue or entitlement is introduced; test both colours/orientations using actual retained input handlers.

## Persistence, evaluation and history

### BA-31

**Save/export and load/import of different actual/selected boards — U,J**

`saveGame/exportGame -> SavedGamesStore.saveGame -> SerializationService.writeGameDocument -> canonical schema`; `loadGame/importGame/restoreGames -> readGameDocument -> insertGame -> _hydrateAndInsertGame -> hydrateGame`.

Save selected/live paths, canonical tree, actual snapshot/result and copied seats; runtime pending/deferred/controller/position caches are omitted by existing schema. Entry/Exit alone do not create move-history/autosave-count events. In-flight actual work belongs to the original in-memory game, not the loaded object. Duplicate insertion follows existing ID-repair semantics. No queue or projected pieces exist here; future premove runtime must remain excluded separately.

### BA-32

**Running restore, alias restoration and analysis-seat preference — U,J**

`App._restoreWorkspace / load flow -> insertGame -> _hydrateAndInsertGame -> hydrateGame -> rebuild parent links and runtime -> normalisePlayers -> register game/focus -> requestPlayerMoveIfNeeded -> optional refreshAnalysisForGame`.

Hydrate explicit-analysis state with independent selected path/cache even at equal contents; ordinary equal following-live selection restores aliases. Preserve separate ordinary historical review. Running clock uses saved relative timestamps and existing timeout reconciliation; actual arming checks ongoing unpaused eligibility and existing owner once. `resumeLiveAnalysisAfterRestore` controls selected analysis-seat restart, not an automatic change to saved real-pause ownership or a second actual search.

### BA-33

**Legacy paused-analysis restore and Resume without Exit — U,J**

`insertGame -> _hydrateAndInsertGame -> hydrateGame -> paused state -> runtime.pauseReasons = [Manual] -> actual request gate returns unready`; optional evaluation refresh remains existing policy.

Preserve saved paused snapshot and independent selected node. Menu return removes only Menu and cannot remove reconstructed Manual. Explicit Resume follows BA-15, enabling actual play with analysis still selected; no synthetic Analysis owner remains and Exit is unnecessary for delivery. If entry/Exit is used before Resume, BA-13 preserves the same Manual ownership. No schema migration or persisted runtime field is added.

### BA-34

**Actual-move analysis capture, no output and different selected position — U,J**

`commitLiveMove -> _applyLiveMove -> Analysis.captureMoveAnalysis before actual board mutation -> existing path/provenance check -> schema-copied seat snapshot or undefined -> addMainlineMove -> nextNode.recordedAnalysis -> moveCommitted`.

Matching canonical parent output may be copied, including independent engine identities/depth/scores/PVs. Unrelated selected output or no output produces no record; capture never waits for an engine. `_advanceRenderedAnalysisBranch` does not create actual-move analysis records. Later evaluation/refresh, actual commits, save/reload and permitted pruning cannot mutate recorded snapshots. Preserve existing autosave ownership/count policy rather than redesigning persistence.

### BA-35

**Independent evaluation seats and actual provider work — U,J**

`selected-position change -> _publishRenderedPosition(changed = true) -> refreshAnalysisForGame -> dispose/clear targeted seats -> _startAnalysisSeat -> _subscribeToAnalysis -> EngineRuntimeService.startAnalysis -> callback seat update -> touchGame`.

Background actual commit with unchanged selection takes `_publishRenderedPosition(false) -> touchGame` and does not restart selected searches. Existing `retryAnalysis(engineIndex)`, `stopAnalysis(engineIndex)`, `removeAnalysisEngine` and modal add/targeted retry affect only captured assignments; other seats and the actual player provider keep their independent owners. Removed/stopped subscriptions reject late output. Keep existing error/retry/UCI ownership; no new driver, counter or shared engine barrier.

### BA-36

**Illegal input and cancelled actual/analysis callbacks — U,V,J**

`board/PV -> _applyMoves full canonical preview validation -> illegal? reject before makeMove`; `invalidating actual action -> clearPlayerTurnRuntime -> abort signal/reject current deferred -> await handler -> late provider sees aborted signal`; `selected engine supersession/removal -> dispose captured subscription -> late callback inactive`.

Preserve whole-request rejection and source engine legality/provenance checks. Do not resolve a different turn from retained UI input; reuse the selected input owner. Cancellation/retry errors remain handled by existing owners. These checks do not invent guarantees for arbitrarily reordered raw UCI records after a completed protocol boundary; native protocol/ponder evidence stays in its existing executed lane.

### BA-37

**Actual sibling appended while selected analysis is below live parent — U**

`commitLiveMove -> reconcileTimeout -> getLiveNode/getLivePosition -> isPathPrefix(livePath, renderedPath) true -> skip destructive prune -> _applyLiveMove -> addMainlineMove -> appendLivePath -> _finaliseLiveMove`.

Keep selected node/path/position and existing tree/children identities intact. Existing history service chooses the new actual mainline child; only the live selector appends its new index. Independent selected board/evaluation remains fixed. No pin registry, deferred cleanup API or extra durable marker is needed.

### BA-38

**Exit before your current actual move advances, then existing pruning — U,J**

`Analyse -> _advanceRenderedAnalysisBranch -> Exit -> _returnToLiveNode` leaves its variation attached. `next real move from that same current live parent -> commitLiveMove -> selected descendants not threatened -> existing pruneFutureMoves(parent) -> _applyLiveMove -> _finaliseLiveMove`.

This is the confirmed own-current-move pruning case. Exit itself does not prune. Preserve existing actual records outside the permitted temporary descendants. Do not use this rule to retrospectively prune an older historical anchor.

### BA-39

**Anchor becomes historical, then branch switch/Exit/save/reload — U**

`BA-37 actual append -> livePath now beyond original anchor -> navigateToNode / exitInGameAnalysis -> selection/state publication only -> saveGame/readGameDocument/insertGame`.

None of those selection/persistence functions calls `pruneFutureMoves` on the older anchor. Retain its analysis continuation as history, exactly as the user clarified. No release handler, Exit cleanup, index rewriting or remembered parent list is introduced. Revisit the original branch after reload and confirm it is still attached.

### BA-40

**Current-move prune, actual Takeback/rewrite and nested-history consistency — U,J**

Run the three existing structural paths separately: `commitLiveMove -> permitted current-parent prune -> actual append`; `takeBack -> clear actual work -> MoveHistoryService.takeBack -> synchronise both selectors/caches`; `_commitHistoryRewriteMove -> cancel old turn -> historical actual continuation without latest-node prune`.

After each, resolve selected/live paths with `getNodeAtPath`, derive board state with `getMoveSequence/genPosition`, then save/reload through BA-31/32. Historical rewrite retains its played sibling variation; current-parent pruning does not expand into old anchors; Takeback discards descendants under its existing explicit policy and safely relocates selection. Actual mainline, surviving records and unrelated branches remain consistent without replacement tree wrappers.

## Delivery and verification boundary

After the user approves the written plan, implement only the internal conditions and existing action composition necessary for these paths. First map each BA case to a retained/new data-driven test or a named existing regression, revise obsolete API/mode/Exit-cleanup expectations, and run the failing baseline. Then change production bodies, run focused unit and mounted tests, followed by affected journeys, code audit and build.

The [main plan](BackgroundAnalysisPlan.md#traceability-to-existing-scenarios-and-journeys) retains SCN/JRN and future-premove mappings. The four [isolated paused-entry probes](questions/play/Q-PLAY-003-PausedAnalysisEntry.md#breakage-audit-after-the-user-requested-a-compatibility-check) establish why these guards are necessary, not that this replanned behaviour has been implemented or passed. BA-Q4 remains pending; keep its two variants visible until answered.
