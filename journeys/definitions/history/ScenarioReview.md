# History scenario review

Reviewed on 16 October 2026 against the working-tree scenarios/contracts based on `36ea082`. Execution evidence belongs to the generated Playwright report. The stable two-game seed, IDs, branches and untimed clocks are retained in owned data; timed examples use Custom with browser time installed before startup.

The review preserves [temporary exploration and actual-move recording](../../../docs/questions/analysis/Q-ANALYSIS-002-VariationRetention.md). Explicit Analyse and ordinary history review keep actual play running under the [approved progression policy](../../../docs/questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md). Selected canonical position and actual turn ownership remain independent. Available pre-move engine output is automatically copied onto actual played nodes, independently of fresh analysis. No output means no record; no exploratory move creates a record. The 21 October presentation correction removes the unrequested recording panel. Saved actual-move records retain the pre-move context and copied engine names, depth, scores and principal variations; browser checks inspect saved data and confirm the extra panel is absent. Broader capture/replacement policies remain separate review prompts.

## JRN-HIST-01

Intent: SCN-HIST-01 selects root, mainline, sibling and nested contexts while preserving the actual line. Classification: implementation defects corrected. The panel omitted the root entirely; Start position now selects it with the same pause guard. Live position depended on an optional cached node and silently did nothing after save/reload in review; it now resolves the persisted live path. Browser assertions cover panel collapse/expand, selected controls, board, last-move highlights, capture display and exact tree/live-path preservation. A separate timed review proves the actual clock keeps running even when the rendered side-to-move differs.

## JRN-HIST-02

Intent: BR-HIST-02-DECLINE-REWRITE cancels before mutation. Classification: aligned. The confirmation leaves the bishop on f1; cancellation preserves the selected e4/e5 node, tree, mainline and clock. Returning live renders the previous continuation.

## JRN-HIST-03

Intent: BR-HIST-02-CONFIRM-REWRITE promotes a new Bc4 continuation while retaining the old Nf3 line and existing Bc4 analysis subtree. Classification: aligned. The browser checks the new mainline index/path, both retained subtrees, immediate board/selection and subsequent live play. Old a6 remains reachable as a variation.

## JRN-HIST-04

Intent: SCN-HIST-03 requires explicit Analyse when Takeback is disabled. Both existing exit preferences are exercised: neither auto-exits explicit analysis. Tests assert disabled ordinary input, explicit exploration, unchanged actual/mainline/result/clock, and deliberate return to live.

## JRN-HIST-05

Intent: SCN-CTRL-04 explores both colours and a three-ply suggested prefix, then exits without a prompt. Timed, untimed and genuinely paused variants check five exploratory nodes, independent actual path, retained tree and exact actual board restoration. Paused exploration retains Resume and Exit preserves the pause. Actual clocks run during ordinary explicit analysis; only real pause owners freeze time.

## JRN-HIST-06

Intent: SCN-HIST-04 prunes superseded latest-node exploration, preserves historical/unrelated branches and protects actual-move records. Classification: recording product gap implemented; pruning aligned. Latest/earlier variants compare retained subtrees and reload the continued position. A separate browser journey creates an actual recorded move through normal UI, explores without creating records, prunes, continues and reloads, then revisits the original record. [Recording integration](../../__tests__/history/Recording.spec.ts) verifies two independent engine snapshots, exclusion of runtime fields, serialisation and the no-output case. Recording captures available output at commit; it never waits for a depth threshold or invents output. See the [capture policy note](../../../docs/questions/analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md).

## JRN-HIST-07

Intent: BR-HIST-01-PAUSED permits explicit analysis input/history during genuine pauses while actual play remains paused. Manual controls keep Resume reachable; a Custom modal retains its focus boundary. Integration checks preserve Manual/Menu owners through Exit and remove only the named owner; final Resume restarts actual play without requiring Exit.

## JRN-HIST-08

Intent: SCN-CTRL-04/05 keeps free-board editing outside a live-game workspace, including finished review. Classification: implementation defect corrected. Finished controls hid Edit board but direct store entry still allowed editing a game with a live path. The state layer now rejects that transition too. Browser variants inspect both analysis and finished controls; [guard integration](../../__tests__/history/BoardEdit.spec.ts) attempts entry and board clearing, preserving tree/root/finality. These contexts expose no edit entry, so optional explanatory-dialog dismissal/setup-shortcut branches are not counted as executed.

## JRN-HIST-09

Intent: SCN-HIST-01 and BR-HIST-01-NODE-MISSING preserve nested workspace selection across hydration and safely ignore detached nodes. Classification: implementation defect corrected. Membership previously followed parent references without checking actual child ownership and could throw during navigation. The guard validates every parent-child link. Browser assertions reload a selected nested alternative, revisit live and a sibling, and compare the complete tree/mainline. [Stale navigation integration](../../__tests__/history/Navigation.spec.ts) covers retained stale parent references, pruned descendants and nodes from another hydrated tree.
