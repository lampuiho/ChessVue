# HistoryPanel

Source: [`src/components/HistoryPanel.vue`](../../../../../src/components/HistoryPanel.vue)

## Purpose
Render the game's move tree as navigable rows and own the panel's saved fold.

## Interface
- Props: `gameId: string`; `disabled?: boolean`, the view's history-input lock.
- Emits: `nodeSelected(node: IMoveNode)`.
- Slots: none.

## Dependencies
- Stores: `GamesStore.getGame` (move tree, `renderedPath`, `livePath`), `UiStateStore` (`layoutState.historyCollapsed`, `setSectionCollapsed`, `saveLayoutState`).
- Children: `AppIcon`.
- Utility: `getSan`.
- Styles: `panels.css` (`.side-panel`, `.history-list`, `.history-row`, `.history-start`, `.panel-chip`).

## Notes
- The panel walks the reactive tree directly, including in-place mutations: each node's mainline child continues at the same depth, and other children follow as variations one level deeper. Rows show the move number prefix, SAN, an *analysis* tag for analysis nodes and a marker on the live node. A runtime `--history-depth` custom property (capped at 4) supplies the indent; the stylesheet owns the layout. No revision prop, watcher or clock tick drives rows.
- Rows, *Start position* and *Live position* all emit `nodeSelected`. The Live position chip appears when the rendered path differs from the live path; the panel resolves the live node itself. `GameView._navigateToNode` cancels playback, checks the game, closes a pending continuation and then calls `GamesStore.navigateToNode`. The panel never mutates the tree.
- The collapse button updates and saves `historyCollapsed` and shows persistence failures inline.
- `disabled` is set during board edit, during playback and in a paused game outside explicit analysis; explicit paused analysis permits review.
- Emitted nodes are references into the current hydrated tree for immediate use, not for storage across a tree replacement.
- Rows are rendered inline from a flattened projection; the earlier `HistoryTree` and `TreeView` component proposals were never implemented.
