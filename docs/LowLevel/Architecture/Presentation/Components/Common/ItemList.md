# ItemList

## Purpose
Render a generic selectable list with optional actions, badges, and empty-state handling.

## Consumes
- ordered item collection
- active or selected item identity
- item label and metadata slots
- optional per-item actions

## Emits
- `itemSelected`
- `itemActionRequested`

## Notes
- `HistoryPanel`, `AnalysisPanel`, and settings engine lists can all build on `ItemList`.
- Tree-specific history rendering may extend this with nested rows while keeping shared selection and row-action behaviour.
