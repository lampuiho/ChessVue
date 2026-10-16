# Setup scenario review

Reviewed on 16 October 2026 against scenarios/contracts and application source based on `cf3719a`, plus this tranche's changes. The review uses the [state](../../../docs/HighLevel/state_model.md), [engine](../../../docs/HighLevel/engine_runtime.md), [settings](../../../docs/HighLevel/settings_contract.md) and [persistence](../../../docs/HighLevel/persistence_contract.md) contracts and the [analysis/setup process](../../../docs/LowLevel/ProcessFlows/AnalysisAndSetup.md). The original two game IDs, opening sequence, editable endgame and untimed seed remain unchanged in owned data. Each browser variant starts with reset storage; reloads omit reset. Exact engine counts belong to the integration lane.

Intent: free exploration remains separate from live moves and actual-move recording, consistent with the [resolved exploration decision](../../../docs/questions/analysis/Q-ANALYSIS-002-VariationRetention.md). Board editing deliberately permits arbitrary positions; these cases add no legal-position validator. No acceptance assertion depends on an unresolved design question. Generated execution evidence and final verification are recorded in [JourneyImplementation.md](../../../docs/JourneyImplementation.md#setup-verification).

## JRN-SETUP-01

SCN-FREE-ANALYSIS-01 / BR-FREE-ANALYSIS-01-NO-ENGINES. Classification: aligned; documentation status drift corrected. The browser plays both colours, returns to c4, creates an alternative, and revisits the original continuation. It checks board, turn, both subtrees and selection, unchanged root/clock, absent players/live path and no engine seats. Free exploration neither creates a live opponent request nor records an actual move. The retained seed needs no engine configuration.

## JRN-SETUP-02

SCN-FREE-ANALYSIS-02 / BR-FREE-ANALYSIS-02-FIRST-EDIT-CLEAR. Classification: implementation defects corrected. Entering and leaving without an effective edit used the root's side to move, turning a black-to-move opening into AnalysisWhiteMove. Editing at the selected root also retained its children, allowing discarded moves to reappear. Browser and integration runs reproduced both failures. Exit now uses the visible position, and an effective edit clears any existing tree even when the root is selected. Independent current/root variants preserve history on empty deletion, verify the full prepared position on the first edit and keep one root on subsequent edits. Integration also covers same-square and empty-source drag no-ops.

## JRN-SETUP-03

SCN-FREE-ANALYSIS-02. Classification: behaviour aligned; component documentation drift corrected. Twelve independently reset variants select each kind in each colour, add it, toggle it off, replace it, right-click delete it, then drag it to another square. Assertions identify both squares, preserve the prepared opening pieces and inspect the single saved root. Later edits cannot recover the discarded opening tree. Palette selection uses accessible kind/colour labels. The low-level Chessboard/PiecePalette notes incorrectly described an extracted component and different events; they now distinguish the actual inline palette from the proposed extraction.

## JRN-SETUP-04

SCN-FREE-ANALYSIS-02 / BR-FREE-ANALYSIS-02-FIRST-EDIT-CLEAR. Classification: aligned. Start analysis on the c4 opening, enter edit, clear to 64 empty squares, reset to the exact original standard root, then finish. Saved root equality covers castling, en-passant, turn and counters; old history and engine lines are absent during editing. A newly rendered engine suggestion is played from the initial board, proving the restarted search does not retain the opening position.

## JRN-SETUP-05

SCN-FREE-ANALYSIS-02 and SCN-CTRL-05 boundary. Classification: aligned. While editing, history/root/player controls are disabled, gameplay actions are absent, analysis refresh is disabled and a stopped failed assignment exposes no retry action. Integration rejects direct moves, navigation, takeback, player reassignment, refresh and retry without mutation or engine starts. UI-10 assertions are retained in the focused Setup integration suites. The reverse boundary (editing inside live-game analysis/review) remains owned and executed by JRN-HIST-08; its optional explanatory-dialog branches are not newly claimed here.

## JRN-SETUP-06

SCN-FREE-ANALYSIS-01/02 / BR-FREE-ANALYSIS-01-ENGINE-NOT-RUNNING and BR-FREE-ANALYSIS-02-ENGINE-REFRESH-FAIL. Classification: aligned. Assigning an engine during edit stores a copied assignment with empty output. Subsequent edits start no work; finishing starts analysis exactly once on the completed position, checked through the real UI and a service spy. A separate unavailable-engine variant retains root/history/assignment, displays the typed actionable failure, then removes the failed assignment and adds a working one. No live turn is scheduled.

## JRN-SETUP-07

SCN-FREE-ANALYSIS-03 / BR-FREE-ANALYSIS-03-CANCEL. Classification: aligned; documentation status drift corrected. Edited-endgame and retained-opening variants cancel a changed form and compare the complete canonical workspace and managed inventory. Confirmation applies local/engine players in both colour arrangements, 9 minutes + 2 seconds and both takeback/live-analysis policy values to the same game identity. The prepared root and full analysis tree survive; the live anchor is the prepared rendered path. One normal board move then produces exactly one engine reply. UI-17's mounted options assertions are migrated intact. Both browser variants join the smoke filter.

## JRN-SETUP-08

SCN-FREE-ANALYSIS-03 / BR-FREE-ANALYSIS-03-INVALID-ENGINE. Classification: aligned. An unavailable required black engine leaves the form recoverable, the opening board/history intact and saved bytes/inventory unchanged. Integration compares every canonical field after failed validation and observes no player request. Correcting the choice in the same form starts exactly one due engine turn, preserves the prior tree and retains the two original workspace identities.

## JRN-SETUP-09

SCN-FREE-ANALYSIS-01/02 and persistence restore contract. Classification: aligned. Separate variants save/reload a selected free-analysis branch and a still-edited endgame. Each compares the restored canonical workspace through a fresh UI save, including mode/root/tree/selection, absent live path/players and stopped clocks. Branch review and both-colour exploration continue; the editor continues mutating its restored root, finishes and permits a legal analysis move. Reload never supplies reset=1.

The complete owning free-analysis scenarios were reviewed, including their no-engine, failed-engine, first-edit, failed-refresh, cancellation and invalid-player-engine branches. Their Planned labels were stale for these exercised flows and are corrected to Current. Finish editing is named explicitly in the scenario prose; no new product policy or optional in-game setup shortcut is introduced.
