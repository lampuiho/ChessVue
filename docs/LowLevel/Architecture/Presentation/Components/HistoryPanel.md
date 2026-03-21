# HistoryPanel

## Purpose
Render the move tree and expose history navigation and prune actions.

## Consumes
- move tree
- visible node identity
- live node identity
- settings-derived prune and rewrite affordances
- `PanelSurface` and `ItemList` for shared panel and row behaviour

## Emits
- `nodeSelected`
- `pruneRequested`
- `returnToLiveNodeRequested`

## Notes
- The component displays mainline and sibling variations but does not mutate the move tree directly.
- History-specific nesting is layered on top of generic item-list selection behaviour.
