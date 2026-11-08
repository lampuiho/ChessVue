# GameControlPanel

Source: [`src/components/GameControlPanel.vue`](../../../../../src/components/GameControlPanel.vue)

## Purpose
Render context-sensitive controls for live play, analysis, study, board editing, review and lifecycle actions.

## Inputs and action ownership
- Props: `gameId: string`; `mode: 'live' | 'paused' | 'inGameAnalysis' | 'freeAnalysis' | 'boardEdit' | 'finished'`; `canTakeBack?: boolean` [`false`]; `navigationDisabled?: boolean` [`false`].
- Emits: `takeBackRequested()`, `analysisRequested()`, `exitAnalysisRequested()`, `nodeSelected(node: IMoveNode)`.
- Slots: none.
- Stores: `GamesStore` (`getGame`, `pauseGame`, `resumeGame`, `enterBoardEdit`, `resignGame`, `offerDraw`, `acceptDrawOffer`, `withdrawDrawOffer`).
- Composables: `useModal`. Domain reads: `MoveApplicationService`, `MoveHistoryService` for the actual live side.
- Children: `ControlButton`; mounted `ConfirmationModal`, `DrawResponseModal`, `GameCreationModal`, `MessageModal`.
- Styles: `game-controls.css` (`.control-panel`, `.control-grid`, `.turn-indicator`, `.control-note`, `.control-button__indicator`).

`GameView` supplies the shared `mode`, the playback-sensitive takeback permission and the history navigation lock; the panel derives pause eligibility (a timed clock) and draw status from its canonical game.

Only `takeBackRequested`, `analysisRequested` and `exitAnalysisRequested` cross into `GameView`'s captured rendered-input owner, which drains playback and closes a continuation before mutating. `nodeSelected` carries the move-step target into `GameView._navigateToNode`, the same workflow history rows use.

Pause and resume, board-edit entry and finish, setup start, resignation and draw negotiation run locally through public `GamesStore` methods. Manual pause and resume use `PauseReason.Manual`, so resuming preserves other pause owners such as Menu. Resignation and draw use the actual live side's colour, even while a historical position is displayed. Failures appear inline in the panel.

## Mode Matrix
| Mode | Controls |
| --- | --- |
| `live` | *Takeback*, *Pause* when the clock is timed, *Analyse*, *Offer draw* / *Resolve draw* with a pending-offer indicator, *Resign*. Heading *Game controls* with a Live indicator. |
| `paused` | *Resume game* only (manual resume). `GameView` adds the contextual *Analyse* or *Exit analysis* button above the panel using its captured input actions. Explicit paused analysis allows board, PV and history exploration while actual takeback, resign, draw and setup stay blocked. Heading *Game paused* with a Paused indicator. |
| `inGameAnalysis` | *First move*, *Previous move*, *Next move*, *Last move*; *Takeback* on actual live history when permitted; *Pause* when timed; *Exit analysis*. Resign, draw and setup actions are hidden. |
| `freeAnalysis` | Move-step buttons, *Takeback*, *Edit board* and *Start game*. Live-only actions are hidden. |
| `boardEdit` | *Finish editing* only. |
| `finished` | Move-step buttons and a note that the result is recorded. Takeback, pause, resign, draw, board edit and setup are hidden. |

Move-step buttons follow the mainline: First selects the root, Previous the parent of the rendered node, Next its mainline child and Last the end of the mainline. They are disabled by `navigationDisabled` and when there is nowhere to move.

## Notes
- **Draw.** With an incoming non-local offer the draw button accepts it; with an outgoing one it withdraws it; in a local-versus-local game it opens the offer confirmation, which hands over to `DrawResponseModal`; against a non-local opponent with no pending offer it sends an offer. The lit indicator dot shows a pending offer, and the label reads *Resolve draw*. Non-local negotiation uses this indicator rather than a dialog.
- **Board edit.** *Edit board* and *Finish editing* both call `GamesStore.enterBoardEdit`, which toggles board edit for a free-analysis workspace. If the game is in in-game analysis the panel shows a `MessageModal` explaining that board editing needs a free analysis workspace; the button is offered only in free analysis, so this is a defensive guard.
- **Start game** opens `GameCreationModal` with the prepared `gameId`.
- **Resign** opens a destructive `ConfirmationModal` that awaits `resignGame` for the captured game and live colour.
- `GameControlPanel` centralises committed gameplay actions so they are discoverable and not duplicated across panels. It stays panel-neutral: entering analysis, resolving a draw and dirty-exit handling do not change sidebar visibility.
- A paused live game is a locked state rather than a reduced live-play variant; see [Q-PLAY-003](../../../../questions/play/Q-PLAY-003-PausedAnalysisEntry.md) for the paused analysis entry decision.
- The six local flows moved here from `GameView` in the [component simplification](../../../../ArchivedPlans/ComponentSimplificationPlan.md#4-let-the-player-strip-and-control-panel-own-their-independent-flows); the three retained events need `GameView`'s captured input owner.
- The component owns its control markup and uses global CSS classes; no watcher or second game controller is added.
