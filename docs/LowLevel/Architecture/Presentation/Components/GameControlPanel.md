# GameControlPanel

## Purpose
Render context-sensitive controls for live play, analysis transitions, setup, and lifecycle actions.

## Inputs and action ownership

Props are `gameId`, `mode` and `canTakeBack`. The view retains the common mode and playback-sensitive takeback permission; the panel derives pause eligibility and draw status from its canonical game.

Only `takeBackRequested`, `analysisRequested` and `exitAnalysisRequested` remain emitted. They cross GameView's captured rendered-input owner, which drains playback and closes continuation before mutation.

Pause/resume, board-edit entry/finish, setup start, resignation confirmation and draw negotiation run locally through the existing public GamesStore methods. Manual resume preserves other pause owners. Resign/draw use the actual live-side colour, including while a historical position is displayed. Failures stay in the control panel.

## Mode Matrix
| Context | Control surface |
| --- | --- |
| Live play | Show `Takeback`, timed `Pause` when applicable, `Resign`, and `Draw`. In local-local games the draw action opens the offer dialog. Against a non-local opponent, `Draw` sends an offer while `drawOfferState` is omitted; when the LED-like pending-offer dot is lit, the same `Draw` control accepts immediately for `drawOfferState.direction = "incoming"` or withdraws the outstanding offer for `drawOfferState.direction = "outgoing"`. Hide setup-only actions. |
| Paused live play | Keep the existing paused panel and `Resume`; GameView adds the contextual `Analyse`/`Exit analysis` action beside it using existing actions and global classes. Explicit paused analysis allows board/PV/history input while actual `Takeback`, `Resign`, `Draw` and setup remain blocked. If a non-local draw-offer indicator is still surfaced elsewhere, it is read-only while paused. |
| In-game analysis | Keep policy-permitted `Takeback` on actual live history, replace `Analysis Mode` entry with `Exit Analysis`, and hide `Pause`, `Resume`, `Resign`, `Draw`, and setup-only actions. |
| Free analysis/setup | Show `Takeback`, `Enter Board Edit`, and `Start Game From Setup`. Hide live-game-only actions such as `Pause`, `Resume`, `Resign`, `Draw`, and in-game analysis entry. |
| Free analysis board edit | Replace normal setup actions with `Exit Board Edit` on the same board-edit control path. Hide live-game-only actions and `Start Game From Setup` until board edit finishes. |
| Finished game review | Keep `Takeback` only when the active policy still allows rewind or review-driven correction. Hide `Pause`, `Resume`, `Resign`, `Draw`, board-edit entry, and start-from-setup actions. |
| Post-timeout analysis | Replace `Analysis Mode` entry with `Exit Analysis`, keep review-safe `Takeback` only when the analysis branch itself can rewind, and hide all live-result-changing actions plus setup-only actions. |

## Notes
- `GameControlPanel` is the primary source of committed gameplay actions from the scenarios.
- Centralising these actions in one component keeps control logic discoverable and avoids duplicating buttons across panels.
- The panel stays panel-neutral: entering analysis mode, resolving draw flow, and dirty-exit handling do not implicitly change sidebar visibility.
- Local-local draw negotiation is dialog-driven, while non-local draw negotiation uses the control's LED-like pending-offer indicator instead of a dialog-hosted response step.
- For non-local opponents, the unlit `Draw` control means offer draw, while the lit state means accept when `drawOfferState.direction = "incoming"` and withdraw when `drawOfferState.direction = "outgoing"`.
- Paused live play is intentionally treated as a locked state rather than a reduced-action variant of live play.
- The component owns its control markup and uses global CSS classes; no watcher or second game controller is added.
