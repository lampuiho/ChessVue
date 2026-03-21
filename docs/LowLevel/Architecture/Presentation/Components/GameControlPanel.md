# GameControlPanel

## Purpose
Render context-sensitive controls for live play, analysis transitions, setup, and lifecycle actions.

## Consumes
- workspace context
- result state
- clock state
- settings-derived policy hints
- `PanelSurface` and `SidePanelButton` for shared panel and action presentation

## Emits
- `enterInGameAnalysisRequested`
- `exitInGameAnalysisRequested`
- `enterBoardEditRequested`
- `confirmBoardEditRequested`
- `cancelBoardEditRequested`
- `pauseRequested`
- `resumeRequested`
- `resignRequested`
- `drawRequested`
