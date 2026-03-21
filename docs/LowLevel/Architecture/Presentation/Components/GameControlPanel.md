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
- `takeBackRequested`
- `enterInGameAnalysisRequested`
- `exitInGameAnalysisRequested`
- `startGameFromSetupRequested`
- `enterBoardEditRequested`
- `confirmBoardEditRequested`
- `cancelBoardEditRequested`
- `pauseRequested`
- `resumeRequested`
- `resignRequested`
- `drawRequested`

## Notes
- `GameControlPanel` is the primary source of committed gameplay actions from the scenarios.
- Centralising these actions in one component keeps control logic discoverable and avoids duplicating buttons across panels.
- `GameControlPanel` contains no HTML or template markup and binds control groups into `PanelSurface`, `ButtonGroup`, and `SidePanelButton`.
