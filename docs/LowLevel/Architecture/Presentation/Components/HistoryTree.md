# HistoryTree

## Purpose
Render nested move-tree rows for mainline and variations.

## Consumes
- move tree data
- visible node identity
- live node identity
- mainline markers

## Emits
- `nodeSelected`

## Notes
- `HistoryPanel` owns panel actions and toolbar state, while `HistoryTree` owns recursive move-tree rendering.
- This split keeps tree-specific nesting out of the panel shell.
- `HistoryTree` contains no HTML or template markup and adapts move-tree data into the common `TreeView`.
