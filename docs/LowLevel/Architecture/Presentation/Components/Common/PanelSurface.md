# PanelSurface

## Purpose
Provide a reusable panel container with shared header, body, footer, and collapse affordances.

## Consumes
- title
- optional toolbar content
- collapsed state
- scroll behaviour

## Emits
- `collapseToggled`

## Notes
- `PlayerPanel`, `HistoryPanel`, `AnalysisPanel`, and `GameControlPanel` should share `PanelSurface` so panel chrome and layout remain consistent.
- Persisted panel visibility still belongs to store-managed state, not to this container.
