# HistoryPanel

## Purpose
Render the move tree and expose history navigation and return-to-live actions.

## Consumes
- move tree
- visible node selection
- live node selection
- `PanelSurface` and `ItemList` for shared panel and row behaviour
- `SidePanelButton` for panel actions
- `HistoryTree` for nested move rendering

## Emits
- `nodeSelected` with the selected hydrated `IMoveNode`
- `returnToLiveNodeRequested`

## Notes
- The component displays mainline and sibling variations but does not mutate the move tree directly.
- Emitted nodes are runtime references from the current hydrated tree and are intended for immediate store use only; callers must discard them after any tree-replacing mutation.
- History-specific nesting is layered on top of generic item-list selection behaviour.
- `HistoryPanel` contains no HTML or template markup and binds history view models into `PanelSurface`, `TreeView`, and action buttons.
