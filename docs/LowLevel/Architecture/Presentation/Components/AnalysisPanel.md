# AnalysisPanel

Source: [`src/components/AnalysisPanel.vue`](../../../../../src/components/AnalysisPanel.vue)

## Purpose
Render the game's ordered analysis seats, manage engine assignments and expose playable PV moves.

## Interface
- Props: `gameId: string`; `disabled?: boolean`, the view-owned move/playback permission for PV buttons.
- Emits: `moveSelected(moves: readonly IMoveRaw[])`, the PV prefix through the clicked move.
- Slots: none.

## Dependencies
- Stores: `GamesStore` (`getGame`, `getVisibleAnalysis`, `refreshAnalysis`, `retryAnalysis`, `stopAnalysis`, `removeAnalysisEngine`), `SettingsStore` (engine inventory size), `UiStateStore` (`layoutState.analysisCollapsed`, `analysisEngineExpandedByIndex`, `setSectionCollapsed`, `setAnalysisEngineExpanded`, `setLayoutState`, `saveLayoutState`).
- Composables: `useModal`.
- Children: `ExpandableText`, `AppIcon`; mounted `AnalysisEngineSelectionModal`.
- Utility: `getSan`.
- Styles: `panels.css` (`.side-panel`, `.analysis-panel`, `.engine-section`, `.analysis-line`).

## Seats and status
- `GamesStore.getVisibleAnalysis` returns every assigned seat, including empty, failed, stopped and restored seats. The panel never reads runtime line maps or filters by position. Only an empty seat list means no engine is assigned; it then shows *No engine assigned* with *Add engine*.
- Each seat shows assignment metadata, a status dot and summary, and the top score and depth even when there is no line. Missing runtime is *Engine unavailable*, not Starting. Ready with an incomplete result is *Analysis stopped*; `isComplete` describes natural completion, not availability.
- Accepted lines stay visible alongside failure feedback (`lastError`). Explicit Stop preserves the current result. Restored lines display without a process.
- Seats and their assigned runtimes are reactive; the panel reads the seat collection and nested fields directly without a revision prop, timestamp dependency or clock tick. Assigned runtimes are shallow-reactive, retaining nested resource identities.

## Analysis and Evaluations modes
- With move suggestions enabled (free analysis, a finished game, or `gameplayOptions.showLiveAnalysisMoves`), the panel is titled *Analysis*. It has panel and per-engine folds and renders `seat.lines` directly, each with a score, the PV in an `ExpandableText` preview and a depth. The engine subscription already selects at most three lines in rank order; there is no template slicing or frontend ranking.
- Each PV move is a separate button labelled `Play through <SAN>`. The full line opens in the `ExpandableText` popover, so every move stays reachable when the preview is truncated. Move buttons are disabled by `disabled`.
- Without move suggestions the panel is titled *Evaluations*: engine names on the left, scores on the right, failure text under the row, and no folds or status and depth summaries. Saved collapse flags do not hide evaluations. Engine management actions appear on row hover or keyboard focus.
- All scores use White's perspective: positive favours White. The panel converts stored side-to-move scores using the root side and the rendered path's ply count, including Black-to-move roots and historical selections. Centipawn and mate scores use the same perspective; engine output and persisted lines are not mutated. The header labels the perspective.

## Actions
- Fold toggles update `UiStateStore` and save the layout; failures stay visible in the panel.
- *Refresh analysis* awaits `refreshAnalysis`. Per-seat *Retry engine* (failed) and *Stop engine* (running or starting) resolve the clicked seat's current index from the seat object before calling the store, so another removal cannot redirect the action to a different seat.
- *Remove engine* calls `removeAnalysisEngine` and, in the same action, removes that seat's entry from `analysisEngineExpandedByIndex` and saves the layout, awaiting both.
- *Add engine* opens `AnalysisEngineSelectionModal` for the game. It is enabled while fewer than four seats are assigned and the inventory has more profiles than assigned seats.
- Board edit disables refresh and retry, which start engines. A genuine pause disables PV moves through `disabled`, while refresh, retry, stop, add, remove and folds stay available; explicit paused analysis keeps PV exploration.

## Notes
- `moveSelected` slices the PV once and keeps the original stable move references as `readonly IMoveRaw[]`. `GameView` chooses actual, exploratory or eligible off-turn delivery without cloning; see [GameView input routing](../Views/Game.md#input-routing).
- Fold indexes follow assignment order, including empty seats.
- The separate Recorded analysis sidebar panel is removed; actual-move records remain in saved game data.
- Per-engine rows are rendered inline. The earlier proposal to extract an `AnalysisEngineSection` component was not implemented: the rows have no other consumer, and extracting them would only add a relay for the panel's own actions.
- Individual PV targets and prefix playback are exercised by JRN-ANALYSIS-03–06/10 ([scenario review](../../../../../journeys/definitions/analysis/ScenarioReview.md)).
