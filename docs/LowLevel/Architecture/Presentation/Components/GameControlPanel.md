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

## Mode Matrix
| Context | Control surface |
| --- | --- |
| Live play | Show `Takeback`, timed `Pause` when applicable, `Resign`, `Offer Draw`, and `Analysis Mode`. Hide setup-only actions. |
| Paused live play | Keep `Takeback`, replace `Pause` with `Resume`, keep `Resign` and `Offer Draw`, and disable `Analysis Mode` entry until the playable live state is restored. |
| In-game analysis | Keep `Takeback` for exploratory navigation, replace `Analysis Mode` entry with `Exit Analysis`, and hide `Pause`, `Resume`, `Resign`, `Offer Draw`, and setup-only actions. |
| Free analysis/setup | Show `Takeback`, `Enter Board Edit`, and `Start Game From Setup`. Hide live-game-only actions such as `Pause`, `Resume`, `Resign`, `Offer Draw`, and in-game analysis entry. |
| Free analysis board edit | Replace normal setup actions with `Confirm Board Edit` and `Cancel Board Edit`. Hide live-game-only actions and `Start Game From Setup` until board edit finishes. |
| Finished game review | Keep `Takeback` only when the active policy still allows rewind or review-driven correction. Hide `Pause`, `Resume`, `Resign`, `Offer Draw`, board-edit entry, and start-from-setup actions. |
| Post-timeout analysis | Replace `Analysis Mode` entry with `Exit Analysis`, keep review-safe `Takeback` only when the analysis branch itself can rewind, and hide all live-result-changing actions plus setup-only actions. |

## Notes
- `GameControlPanel` is the primary source of committed gameplay actions from the scenarios.
- Centralising these actions in one component keeps control logic discoverable and avoids duplicating buttons across panels.
- The panel stays panel-neutral: entering analysis mode, resolving draw flow, and dirty-exit handling do not implicitly change sidebar visibility.
- `GameControlPanel` contains no HTML or template markup and binds control groups into `PanelSurface`, `ButtonGroup`, and `SidePanelButton`.
