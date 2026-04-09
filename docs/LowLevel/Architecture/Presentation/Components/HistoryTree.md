# HistoryTree

## Purpose
Render nested move-tree rows for mainline and variations.

## Consumes
- move tree data
- visible node selection
- live node selection
- mainline markers

## Emits
- `nodeSelected` with the selected hydrated `IMoveNode`

## Notes
- `HistoryPanel` owns panel actions and toolbar state, while `HistoryTree` owns recursive move-tree rendering.
- The emitted node must come from the current hydrated tree and is valid only until a later tree-replacing mutation occurs.
- This split keeps tree-specific nesting out of the panel shell.
- `HistoryTree` contains no HTML or template markup and adapts move-tree data into the common `TreeView`.
