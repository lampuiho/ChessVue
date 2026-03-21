# TreeView

## Purpose
Provide a reusable recursive tree renderer for hierarchical data with selection and row actions.

## Consumes
- tree items
- active item identity
- item content slot
- optional row action slot

## Emits
- `itemSelected`
- `itemActionRequested`

## Notes
- `HistoryPanel` uses `TreeView` for move-tree rendering.
