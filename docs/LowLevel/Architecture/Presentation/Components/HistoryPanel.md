# HistoryPanel

Props are `gameId` and `disabled`. The panel reads the canonical root, rendered/live paths and saved collapse preference from `GamesStore` and `UiStateStore`.

The panel traverses reactive children and paths directly, including in-place mutations. Its collapse action updates and saves `historyCollapsed` locally and displays persistence failures in the panel. No revision prop, watcher or clock tick drives rows.

Rows, Start position and Live position all emit the same `nodeSelected(IMoveNode)` event. The live button resolves its node locally. `GameView._navigateToNode` retains playback cancellation, captured-game validation and continuation dismissal before the store navigation action. The panel never mutates the tree itself.

Ordinary paused live play disables navigation; explicit paused analysis permits review. Emitted nodes are references from the current hydrated tree and are for immediate use, not storage across a tree replacement.
