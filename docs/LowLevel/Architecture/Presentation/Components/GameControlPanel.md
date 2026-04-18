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
- `pauseRequested`
- `resumeRequested`
- `resignRequested`
- `drawRequested`

## Mode Matrix
| Context | Control surface |
| --- | --- |
| Live play | Show `Takeback`, timed `Pause` when applicable, `Resign`, and `Draw`. In local-local games the draw action opens the offer dialog. Against a non-local opponent, `Draw` sends an offer while `drawOfferState` is omitted; when the LED-like pending-offer dot is lit, the same `Draw` control accepts immediately for `drawOfferState.direction = "incoming"` or withdraws the outstanding offer for `drawOfferState.direction = "outgoing"`. Hide setup-only actions. |
| Paused live play | Show `Resume` as the only enabled gameplay action. Hide or disable `Takeback`, `Pause`, `Analysis Mode`, `Resign`, `Draw`, and setup-only actions until the playable live state is restored. If a non-local draw-offer indicator is still surfaced elsewhere, it is read-only while paused. |
| In-game analysis | Keep `Takeback` for exploratory navigation, replace `Analysis Mode` entry with `Exit Analysis`, and hide `Pause`, `Resume`, `Resign`, `Draw`, and setup-only actions. |
| Free analysis/setup | Show `Takeback`, `Enter Board Edit`, and `Start Game From Setup`. Hide live-game-only actions such as `Pause`, `Resume`, `Resign`, `Draw`, and in-game analysis entry. |
| Free analysis board edit | Replace normal setup actions with `Confirm Board Edit`. Hide live-game-only actions and `Start Game From Setup` until board edit finishes. |
| Finished game review | Keep `Takeback` only when the active policy still allows rewind or review-driven correction. Hide `Pause`, `Resume`, `Resign`, `Draw`, board-edit entry, and start-from-setup actions. |
| Post-timeout analysis | Replace `Analysis Mode` entry with `Exit Analysis`, keep review-safe `Takeback` only when the analysis branch itself can rewind, and hide all live-result-changing actions plus setup-only actions. |

## Notes
- `GameControlPanel` is the primary source of committed gameplay actions from the scenarios.
- Centralising these actions in one component keeps control logic discoverable and avoids duplicating buttons across panels.
- The panel stays panel-neutral: entering analysis mode, resolving draw flow, and dirty-exit handling do not implicitly change sidebar visibility.
- Local-local draw negotiation is dialog-driven, while non-local draw negotiation uses the control's LED-like pending-offer indicator instead of a dialog-hosted response step.
- For non-local opponents, the unlit `Draw` control means offer draw, while the lit state means accept when `drawOfferState.direction = "incoming"` and withdraw when `drawOfferState.direction = "outgoing"`.
- Paused live play is intentionally treated as a locked state rather than a reduced-action variant of live play.
- `GameControlPanel` contains no HTML or template markup and binds control groups into `PanelSurface`, `ButtonGroup`, and `SidePanelButton`.
