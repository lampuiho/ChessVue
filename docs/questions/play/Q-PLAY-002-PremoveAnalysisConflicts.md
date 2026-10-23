# Q-PLAY-002 — Premove presentation, analysis and conflicts

| Field | Value |
| --- | --- |
| Status | Product choices resolved; raw data declaration and scenario tests migrated/executed on 23 October. Premove behaviour implementation remains pending |
| Raised/resolved | 21 October 2026 |
| Decision source | User numbered answers and subsequent explicit corrections through 22 October 2026 |
| Parent plan | [Premove and player-turn flow](../../PreMovePlan%28ToDo%29.md) |
| Evidence | [Raw/no-buttons scenario baseline](../../PreMovePlan%28ToDo%29.md#raw-move-scenario-baseline---23-october-2026): all 25 IDs, 409 tests, 291 pass/118 fail; type checking and code audit pass |
| Related decisions | [Background analysis](Q-PLAY-001-LiveProgressDuringAnalysis.md), [temporary exploratory branch/recording scope](../analysis/Q-ANALYSIS-002-VariationRetention.md) |

## Resolved decisions

These replace the earlier open recommendations. Resolved design does not mean the feature is implemented.

| Answer | User decision | Consequence |
| --- | --- | --- |
| 1 | Keep rendered position without premoves; derive the pieces after applying premoves to that board | Analysis/engine input continues using canonical rendered position. Draw a copied piece array plus red-square union; no speculative canonical position |
| 2 | Analysis does not stop the clock; live play continues. Hotseat has no previous-player off-turn premove/analysis | Remove automatic Analysis pause and selected-board turn-scheduling gates. Test background clocks and successive turns explicitly |
| 3 | Explicit button enters analysis on the current move | Anchor the currently selected canonical move and route its board/PV input to exploration only. History selection alone does not grant analysis input or edit the queue |
| 4 | Just play queued moves during review | No review suspension. Queue/engine turns continue; return displays what remains rather than restoring an entry-time sequence |
| 5 | No premoves in a local game; moving hands the board to the opponent | Delete two-local-colour queue/selector design. Premove input is for a human versus an engine; only the actual side due owns hotseat live input |
| 6 | Takeback is always on the live game | Keep it an actual rewrite/cancellation boundary. History navigation does not become Takeback or premove undo |
| 7 | All eligible moves on opponent's turn append unless in analysis | No implicit replacement or separate Play now mode for the same off-turn human input. Engine output still belongs to the actual engine turn |
| 8 | Keep intentions across temporary navigation | Preserve the in-memory queue across menu/tab changes. Existing Manual/Menu pause rules still apply; close/disposal ends ownership |
| 9 | Premoves are not history; invalid premoves clear the whole queue | No speculative move nodes, retained unavailable tail, skipping or revival. Clear every remaining entry/shade on invalidation |

## Subsequent decisions carried into the replan

These later instructions supersede incompatible details in older drafts. They do not reopen answers 1-9.

| Decision | Required plan consequence |
| --- | --- |
| Reuse `IMoveRaw` | Queue stores `IMoveRaw[]`; remove the custom entry interface rather than aliasing it or copying its fields. No stored expected kind; derive the piece from the projected/actual board |
| Include the raw-submission prerequisite | Completed the [CodexFollowUp item](../../CodexFollowUp.md#raw-move-submission) as PRE-RAW with tests first: legal selection/promotion and board/view/store submission stay raw, then canonical acceptance enriches for existing detailed services/history. Its own tests must fail before the refactor and pass before queue implementation |
| No queue anchor | Current actual live position is the base. Keep exact seated-player ownership; no duplicated node/path/FEN, including Black before its first move |
| Chess rules remain a proper utility | Extend existing `GameRuleUtility`; no premove utility/library. Use generic `genCandidateMovesForPiece` and existing legal/detail/application APIs |
| No count or premove buttons | No queue count/list or Undo/Clear controls in GameControlPanel. Cancel the whole queue through live-board right-click; touch tap a premoved piece. Retain Escape access and board-edit deletion |
| Paused analysis allowed | Preserve Q-PLAY-003: entry, exploratory moves/history and Exit work without releasing genuine Manual/Menu ownership. Actual commits and premove editing remain paused |
| Preserve history policy | Only existing own-current-move pruning applies. A selected branch whose anchor became historical remains history through Exit/navigation; no deferred pruning registry |
| Ordinary history input | Retain the existing actual-rewrite confirmation when Takeback is allowed. Require Analyse for exploratory input when Takeback is disabled |
| Tests before behaviour | First migrate the data boundary with its assertions; then write/revise all raw scenario tests and record meaningful failures before gameplay/presentation development |
| Full replan after undo | This revision edits the plan/data-design/decision documents only. No code/test changes or renewed implementation until the revised plan is approved |

The chess.com reference concerns the cancellation gesture only. It does not add its timing deduction, queue cap, persistence policy or an alternative rendering/background-play rule. A cancel gesture is not a move submission; all completed eligible move submissions still append.

On 23 October the user authorised updating the flows and writing the scenario unit tests, clarifying that "markRaw" meant the `IMoveRaw` submission refactor. This authorises the raw queue declaration/test migration after the prior documentation-only replan. It does not authorise premove gameplay development or change any resolved product choice above.

The sequence remains game-owned through analysis, but it can be consumed or cancelled by background actual play. Reapplying on exit means recomputing the **remaining** valid queue over the latest live board; it never means rewinding actual play or restoring already-executed entries.

Coverage-audit clarifications on 21 October: the user confirmed that pruning applies only when the branch comes from their own current move. Once background actual progression leaves that anchor behind, the branch remains history; do not introduce Exit/navigation cleanup. The user also confirmed preserving the existing history-move rewrite confirmation when Takeback is allowed, and requiring explicit Analyse for exploratory input when Takeback is disabled. These choices do not approve implementation of the written analysis plan.

For navigation, preservation and existing clock pauses remain separate: changing the selected board/view is not itself a queue pause; an actually applied Manual/Menu pause still blocks all actual commits.

Later clarification: [Q-PLAY-003](Q-PLAY-003-PausedAnalysisEntry.md) allows explicit Analyse entry and analysis moves/history while actually paused, preserving real pause ownership. Both decisions are resolved and implemented by the separate analysis prerequisite.

## Historical implementation audit before the split

The following source/test observations describe 21 October, before the [analysis prerequisite](../../BackgroundAnalysisPlan.md) was implemented and verified. They are retained as historical evidence, not current defects. The former queue declaration was added afterwards; its entry shape is superseded by the revised [raw queue design](../../PremoveDataStructure.md), whose implementation/tests remain pending approval.

| Boundary | Observed implementation | Required implementation |
| --- | --- | --- |
| Analyse entry | [GameMoveComposable](../../../src/state/game/GameMoveComposable.ts) adds `PauseReason.Analysis` and freezes the clock | Explicit analysis selection with no automatic clock/queue pause |
| Actual turn arming | [GamePlayerTurnComposable](../../../src/state/game/GamePlayerTurnComposable.ts) requires live state and equal rendered/live paths | Arm ongoing actual turns regardless of selected analysis/history node |
| Selected/live board cache | [GamePositionComposable](../../../src/state/game/GamePositionComposable.ts) re-aliases positions whenever paths have equal values | Keep explicit analysis independent even before its first exploratory move; only alias while following live |
| Live finalisation/pruning | Live commit tests path equality to follow selected board and prunes descendants at its parent | Respect explicit selection ownership and protect its active temporary branch during background play |
| Explicit analysis versus review | [GameView](../../../src/views/GameView.vue) treats shared `LiveAnalysisFrom*` families as analysis controls | Explicit Analyse action owns exploration permission; history review alone is not entry |
| Queue capability | No premove UI/runtime exists | Human-engine off-turn queue only; no hotseat/engine-engine premoves across any gesture |
| Takeback | Rewinds actual play even during analysis and may reapply Analysis pause | Preserve actual rewind semantics, clear queue and safely relocate removed selection; do not create Analysis-owned pause |
| Saved paused analysis | [Hydration](../../../src/state/game/GameWorkspaceComposable.ts) reconstructs Analysis plus Manual pause owners | Preserve saved paused timing until explicit Resume, without a synthetic Analysis pause that requires exit to resume |

At that audit, analysis entry **did pause**, and the tests verified that old contract. Those historical passes were not evidence for background analysis. The later prerequisite changed and verified that behaviour separately, as recorded in its implementation evidence.

On 21 October 2026, a focused run of [GamesStore.spec.ts](../../../src/state/__tests__/GamesStore.spec.ts) passed these four existing tests, with 41 tests unselected:

- `tracks paused live-analysis states across analysis entry and pause or resume transitions`.
- `detaches rendered analysis from the live position and re-aliases it on exit`.
- `detaches the rendered path during in-game analysis and re-aliases it on return to live play`.
- `derives history navigation state for live and non-live analysis contexts`.

[Browser JRN-RACE-02](../../../e2e/journeys/engine-races/Pause.spec.ts) was inspected, not rerun: it expects actual history/clock to stay fixed inside Analyse and the held reply to commit after exit. Replace that Analysis-freeze expectation; retain the neighbouring genuine Manual/Menu pause tests. The parent plan records the exact focused command. No new background/premove test is claimed.

## Conflict register and implementation handling

| Conflict | Settled handling / implementation task |
| --- | --- |
| C01: speculative picture versus canonical rendered board | Keep `renderedPosition` unchanged. Derive copied displayed pieces/red IDs only at the drawing boundary; never feed them into engines, legal moves, clocks, check, captures or saves |
| C02: entering analysis from projected pieces | Explicit Analyse anchors the currently selected canonical move without queue displacement. Preserve background queue ownership; do not pause clock or show its red shading on the exploration board |
| C03: exit confused with replay/resume | Return to latest actual live position and project the remaining queue. No clock transition, duplicate search, second delivery or restoration of entries consumed while away |
| C04: engine replies during analysis | Commit actual reply at arrival, validate/commit due human head and start the next actual engine turn while analysis stays anchored. Never hold a valid reply solely for Exit |
| C05: genuine Manual/Menu pause | Only real pause ownership blocks commits. Resume removes its own reason and restarts the actual driver once, whether analysis is still displayed or not |
| C06: analysis input versus queue input | Explicit analysis board/PV moves only explore. All eligible off-turn gameplay input appends. No board gesture simultaneously modifies an analysis branch and the queue |
| C07: history review with actual progression | Keep queue/clock/turns running behind the selected node. History does not implicitly enable analysis; entry remains explicit. Return shows current remainder or empty/cancelled status |
| C08: local-local ownership | No hotseat queue or selector. Every actual move hands input to the other side. Reject the previous side's off-turn gesture/analysis session, including drag started before handoff |
| C09: Takeback during analysis | Always take back actual play. Clear queue and drain old actual turn first; if selected branch was removed, cancel playback and select a surviving node. Never treat it as queue undo |
| C10: historical rewrite | Confirmed actual continuation clears the queue/old turn before replacing live ownership. Cancelled/no-op actions do not. Analysis-only input does not implicitly rewrite actual play |
| C11: engine suggestions while opponent is due | Eligible own-colour gameplay suggestions append like gestures; explicit analysis explores. Opponent-colour output cannot be submitted as the human's actual move or force replacement |
| C12: evaluation and recorded analysis | Evaluations describe canonical rendered position. Background actual commits cannot copy unrelated exploratory output as actual-parent recorded analysis. Queue display/edit alone causes no engine search restart |
| C13: active branch pruned by actual play | Preserve the active selection while appending actual mainline children. If its anchor becomes historical, keep that branch as history through Exit/navigation. Prune only the existing own-current-move case; no deferred cleanup registry or boundary |
| C14: view remount or tab switch | Queue belongs to game, not Chessboard/GameView lifetime. Dispose unfinished gestures/playback, preserve and execute queued input according to genuine pause policy |
| C15: invalid sequence after rebase | Reproject whole remaining sequence after actual changes. If it cannot project or the due move is illegal, clear the complete queue and all red shading, with no partial speculative history |
| C16: late drag/promotion/PV | Bind unfinished input to actual context and cancel on mode/base/queue changes. A late callback cannot become a fresh queue entry or mutate replacement ownership |
| C17: result/seat/root replacement | Cancel queue and settle actual work on timeout/result, real reassignment, setup/root replacement or disposal. Analysis exit cannot revive play. No-op assignment does not cancel |
| C18: save/load isolation | Save canonical selected/live workspace, not queue/display/turn runtime. Continued in-memory game retains its queue; restored game has none. Keep legacy paused saves explicitly paused |
| C19: background start at equal paths | Detach board caches as well as path arrays. A reply before any exploratory move must not mutate selected snapshot or cause the view to follow live merely because paths initially match |
| C20: projection/highlight layers | Pieces occupy projected destinations; every pending endpoint is red at one opacity, including castling rook movement. Distinguish actual-last outline, selection and focus; derive actual check from canonical state |
| C21: generic raw data versus source validation | Reuse existing `IMoveRaw`; read source colour/kind at each projected/actual step and exact promotion through rules. No expected-kind field or alternate entry type |
| C22: cancellation versus append/exploration | Board right-click or touch tap on a premoved piece clears the whole live queue; mouse selection still chains. No counts/buttons/Undo-last. Analysis/review/pause and stale input cannot clear the background queue; board-edit right-click deletes only its piece |
| C23: obsolete tests/evidence after replan | Migrate old kind/button/Undo fixtures to raw source-geometry/promotion and board cancellation cases. Preserve all scenario IDs; record a fresh red baseline before behaviour code. Older test counts remain historical |

Protecting active analysis does not add a new cleanup boundary. Existing current-move pruning remains, while branches left at historical anchors stay available as history per the user's audit clarification. The [actual-move recording scope](../analysis/Q-ANALYSIS-002-VariationRetention.md) remains unchanged: exploratory nodes are not actual-move analysis records, and premoves are not history.

Full legality applies to the next due move, while the whole queue must remain projectable under the documented speculative rules. Do not reject every future off-turn intention using today's full chess legality, but do not retain a known unprojectable suffix either.

## Concrete scenario matrix

The parent plan restores the [test-ready scenarios](../../PreMovePlan%28ToDo%29.md#concrete-scenarios-for-unit-tests), [function flows](../../PreMovePlan%28ToDo%29.md#function-flow) and [plain-data fixture/assertion specification](../../PreMovePlan%28ToDo%29.md#data-driven-unit-test-specification). The PRE-S01-PRE-S25 IDs below remain their product traceability record; use the parent plan for execution order and exact queue/state assertions.

These are required planned checks, not passing acceptance. Where implementation details were not explicitly specified by the user, the parent plan provides the recommended mechanism; expected product behaviour follows the decisions above.

| Scenario | Actions / fixture | Required observable behaviour |
| --- | --- | --- |
| PRE-S01: chained drawing | Human White queues `g1-f3`, `f3-g5` during engine Black turn | Display knight `g5`, empty `g1`/`f3`, red union of all three. Canonical rendered/live knight stays `g1` until actual commit; no speculative node/increment |
| PRE-S02: consumption/cancellation | First head commits, then cancel remaining f3-g5 before the next local turn | Before cancellation, only f3/g5 are red and the knight is displayed on g5. Whole clear shows actual Nf3 without queue shade; actual history/clock remain |
| PRE-S03: marks/orientation/board cancellation | Shared squares, both orientations, right-click empty/ordinary/premoved squares and touch tap a premoved piece | One red opacity per square; consistent absolute squares. Whole clear rebuilds canonical pieces. No counts/buttons; mouse selection still chains; cancelled/empty input creates no actual move |
| PRE-S04: special drawing | Queued capture, chosen promotion and castling | Correct displaced pieces without actual capture/rights/result changes; explicit promotion required, reversible display on Clear; both castle pieces move |
| PRE-S05: explicit entry | Queue exists during engine search; click Analyse on selected canonical move | Analysis starts there without premove displacement; actual clock/search/queue continue. Selecting history alone previously did not enable analysis input |
| PRE-S06: independent exploration | Explore moves matching queue coordinates while actual play advances | Analysis input changes only its branch; actual turn consumption alone removes entries. Selected analysis board/evaluations stay at its own node |
| PRE-S07: exit before reply | Exit before current engine completes | Return shows latest canonical live position plus unchanged remaining queue; clock was never paused/resumed by analysis; human head does not play before its turn |
| PRE-S08: successive background turns | Hold/release engine results while analysis is displayed with several valid local premoves | Engine reply, due local move and next engine search proceed before Exit. Assert multiple interleaved actual moves, correct actual clocks/increments and stable selected board |
| PRE-S09: background queue invalidation | Real reply captures intended source, creates a blocker or makes due move illegal | Commit legal opponent move once, clear every remaining intention/red shade, leave actual local turn waiting, retain actual clock and selected analysis board |
| PRE-S10: genuine pause while analysing | Add Manual/Menu, release a provider, remove non-final then final owner | No actual commits/increments while a real pause remains. Final Resume can commit/drain/start successor even while analysis remains displayed; Exit is not required |
| PRE-S11: review without editing | Review old node while queue executes; leave no queue editing controls in review | Existing valid sequence continues despite inability to edit. Show actual progression/status; return projects only remainder, never old snapshot |
| PRE-S12: explicit current-move anchor | Navigate to earlier canonical move and press Analyse there | Anchor that selected node, not current live or premoved picture. Actual game advances independently. Board/PV input is exploratory only after explicit entry |
| PRE-S13: historical rewrite | Request explicit actual continuation; cancel, then confirm | Cancel preserves queue. Confirm clears whole queue and drains old actual owner before rewrite; selected analysis cannot retain removed paths |
| PRE-S14: Takeback is live | Analyse several plies away from actual live; use Takeback | Actual game rewinds under existing allowTakeback policy, queue clears and invalid selected path/playback relocates safely. Merely selecting a previous analysis node never takes back actual play |
| PRE-S15: suggestion routing | Select eligible own-colour suggestion on own turn/opponent turn/in Analyse; try opponent-colour output | Actual commit / append / exploration respectively. Never implicit replacement on opponent turn or human acceptance of engine-owned colour. Respect suggestion-playability preference |
| PRE-S16: active branch/history retention | Explore from current live parent, then let actual replies/premoves advance from it | Selected branch remains valid through actual commits and stays as history once its anchor is historical, including after Exit/navigation/save. Retain only existing own-current-move pruning; no delayed cleanup |
| PRE-S17: hotseat exclusion | Local-local White moves; deliver stale White-owned click/drag/drop/analysis request after handoff | No queue or old-side input. Fresh input and the Analyse button now belong to Black on its current move; no person authentication is implied. Repeat both colours/orientations and enforce the boundary beyond visual controls |
| PRE-S18: unfinished input | Promotion/drag active, then actual reply, queue clear or analysis/route change; delayed analysis PV on Exit | Unfinished input/playback settles without late append/actual mutation. Completed queue entries remain game-owned unless consumed/invalidated |
| PRE-S19: navigation retention | Queue exists; visit Settings, switch games, return, then close tab | Retain per game. Continue unless real Menu/Manual policy pauses; returning does not replay consumed entries. Explicit close cancels; other game's queue unaffected |
| PRE-S20: later dependency invalid | Rebase makes a later queued move unprojectable while head alone could still play | Clear entire remaining queue immediately, including otherwise-projectable head. No unavailable suffix, skip or history node |
| PRE-S21: actual terminal/structural change | Timeout during analysis, mate, real reassignment, setup/root change or disposal | Clear queue/actual work, show correct result/stopped clock and surviving review. Exit cannot restart finished actual play or restore queue |
| PRE-S22: engine/save isolation | Edit/project queue, run independent analysis seats, save/export/load | Analysis uses canonical rendered FEN; queue drawing never changes saved positions/search count/capture tally. Background actual recording never copies different selected output. Restore has empty queue |
| PRE-S23: equal-path race | Enter Analyse and make no exploratory move; release engine reply immediately | Actual board advances but selected canonical snapshot/path remain on entry node. Proves cache isolation, not merely array copying |
| PRE-S24: local clock during analysis | Analyse during human turn with empty queue, advance fake time past deadline | Actual human clock runs/expires normally; selected analysis input cannot hide/refresh actual timeout or resume a completed result |
| PRE-S25: legacy paused restore | Load saved paused live-analysis state from previous behaviour | Keep actual clock paused until explicit Resume; no extra Analysis-owned pause/Exit requirement, empty queue and safe selected node |

Use real-rule/store integration with held providers for actual background ordering and full-clear behaviour, plus component/browser drawing and input tests in both orientations and supported keyboard/touch flows. Keep native UCI/ponder acceptance scoped to the platform actually executed.
