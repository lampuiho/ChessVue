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
- Panel visibility and fold state belong to higher-level UI/session state, not to this container.
