# GameView

Source: [`src/views/GameView.vue`](../../../../../src/views/GameView.vue) · Route: `/game/:id`

## Purpose
Compose the game workspace for the route's canonical game and retain the workflows that need one owner across several child components: the rendered board and its input, playback, historical continuation, the clock and game-end notice, Menu interruption and route activation. Feature components read their own game data by `gameId` rather than receive copied player, tree, seat or menu-capability props.

## Composition
| Region | Child | Bindings |
| --- | --- | --- |
| Navigation | `MenuBar` | `game-id`; `homeRequested`, `customNewGameRequested`, `loadGameRequested`, `saveGameRequested`, `settingsRequested` enter the Menu-interruption workflow |
| Tabs | `GameTabs` | None |
| Board column | `PlayerPanel` × 2 | `colour`, `game-id`, `selection-disabled` (playback lock), `remaining-ms`, `active`, `captured-pieces` |
| Board column | `Chessboard` | `position`, `display-position`, `premove-squares`, `premove-colour`, `orientation`, `show-coordinates`, `highlight-last-move`, `last-move`, `input-disabled`, `board-edit`; `moveAttempted` → `inputActions.move`, `premovesCancelled` → `inputActions.cancelPremoves`, the five board-edit events → `GamesStore.toggleChessPiece`, `deleteChessPiece`, `moveChessPiece`, `clearBoard`, `resetBoardToStartPosition` |
| Sidebar | `HistoryPanel` | Mounted when `layoutState.showHistoryPanel`; `game-id`, `disabled`; `nodeSelected` → `_navigateToNode` |
| Sidebar | `AnalysisPanel` | Mounted when `layoutState.showAnalysisPanel`; `game-id`, `disabled`; `moveSelected` → `inputActions.line` |
| Sidebar | `ControlButton` | Only in paused mode: *Analyse* or *Exit analysis* → `inputActions.analyse` / `inputActions.exit` |
| Sidebar | `GameControlPanel` | `game-id`, `mode`, `can-take-back`, `navigation-disabled`; `takeBackRequested`, `analysisRequested`, `exitAnalysisRequested` → `inputActions`; `nodeSelected` → `_navigateToNode` |

The sidebar title shows *Game workspace* or *Analysis study*, the game name and a result badge (side to move, or the result). The page renders nothing until the route's game and its position resolve. Mounted modals: `GameCreationModal`, `ConfirmationModal` (historical continuation) and `GameResultModal`.

Dependencies: `GamesStore`, `SettingsStore`, `UiStateStore`, `useGamePosition().getPremoveProjection`, `useModal`, `OperationOwner`, and pure reads from `MoveApplicationService`, `MoveHistoryService`, `TimeControlService` and the chess utilities. Styles: `workspace.css` for the page layout, `app.css` for the toast, `game-controls.css` for the paused control grid.

## Retained Owners
- **Rendered board.** `renderedBoard` computes the canonical position of `renderedPath`, the permissions that apply to it, and, for a human-versus-engine game showing its live position, the premove queue, the held local move and their projection (`displayPosition`, `premoveSquares`). When the game, node, position, permissions, queue references and premove colour are unchanged it returns the previous object, so an unrelated publication such as a new analysis score does not replace `Chessboard`'s props and cancel an unfinished gesture.
- **Input actions.** `inputActions` binds every board, PV and control action to the `renderedBoard` that was rendered when the user acted. `move` and `line` are ignored if the owner has since been replaced; `analyse`, `exit`, `takeBack` and `cancelPremoves` run through `_runInputAction`, which rejects a replaced owner, drains playback, rechecks the owner and closes a pending continuation before calling `enterInGameAnalysis`, `exitInGameAnalysis`, `takeBack` or `clearPremoves`.
- **Playback.** One `OperationOwner` owns multi-move PV playback. `_applyMoves` preflights the whole sequence on a copy of the rendered position, then plays moves 350 ms apart, checking the abort signal, game, tree, mode, result, input permission and expected path before each `GamesStore.makeMove`. `isPlayingLine` locks board, history, takeback and player selection during playback.
- **Historical continuation.** Board or PV input on a historical position of an ongoing game with takebacks allowed opens a `ConfirmationModal` that captures the game, node and raw moves; `_confirmContinuation` rechecks them before applying. `_closeContinuation` closes it at input, navigation, route-leave and unmount boundaries.
- **Clock and game end.** One 250 ms interval updates `now`, from which `TimeControlService.getRemainingTime` drives both player clocks, and calls `_reconcileGameEnd`. When a running clock reaches zero it calls `GamesStore.syncClock` so the store records the timeout. Whenever the game's runtime `resultNotificationPending` flag is set, for any result reason, the view clears it and opens `GameResultModal` once.
- **Captured material.** One traversal of the rendered path groups captured pieces by capturing colour for both player strips.
- **Menu interruption.** `_handleMenuInterruptionRequested` cancels playback and, when `gameSession.autoPauseOnMenu` is on, pauses with `PauseReason.Menu` before navigating to Home, Load, Save or Settings, or opening custom creation. `_handleMenuInterruptionCompleted` resumes only the Menu pause owner. Custom creation passes an `onClosed` callback that completes the interruption only if the interrupted game is still displayed.
- **Route activation.** `_activateGame` runs on mount and in `onBeforeRouteUpdate`: it cancels playback, closes a continuation, refreshes `now`, completes a pending Menu pause for the selected game, or returns a fallback route (the first open game, else `/home`) when the game does not exist. `onBeforeRouteLeave` closes the continuation and cancels playback.
- **Notices.** `_run` shows action failures as a 3.6-second toast. The view registers one `GamesStore.onAutosaveFailed` consumer and disposes it on unmount, with the timers and playback owner.

## Input Routing
| Input | Route |
| --- | --- |
| Board move while a premove colour applies | `GamesStore.makeMove` with the raw move; the store appends it to the queue |
| Board move or PV on a historical position of an ongoing live game, takebacks allowed, not analysing | Historical-continuation confirmation, then `_applyMoves` |
| Board move otherwise | `_applyMoves` |
| PV in free analysis, a finished game or in-game analysis | Whole selected prefix through `_applyMoves` |
| PV on a local due turn | First move only |
| PV on an eligible off-turn | Only the clicked move, and only if it belongs to the local colour by parity and is a candidate on the projected board; no opponent replies are queued |
| History row, Start, Live position or move-step button | `_navigateToNode`: cancel playback, recheck the game, close continuation, `GamesStore.navigateToNode` |

Raw `IMoveRaw` references pass from the board and PV through to the store without cloning; canonical legality and move details come from the store ([raw move submission design](../../../../ArchivedPlans/RawMoveSubmissionDesign.md)).

## Control Mode and Permissions
| Value | Rule |
| --- | --- |
| `controlMode` | First match of `boardEdit`, `paused` (any paused state, including paused in-game analysis), `finished`, `inGameAnalysis`, `freeAnalysis` (no live path), else `live` |
| `canInput` | In-game analysis: yes. Paused: no. Free analysis, finished or board edit: yes. Historical position in a live game: only a prefix of the live path with takebacks allowed. Live position: the side to move is local, or a premove colour applies |
| `premoveColour` | The local colour in a human-versus-engine game, at its live position, while the engine is to move and the game is not paused, analysing, editing or finished |
| Board `inputDisabled` | `!canInput` or playback |
| History and move-step `disabled` | Board edit, a paused game outside in-game analysis, or playback |
| Analysis `disabled` | Board input disabled or board edit |
| `canTakeBack` | Not board edit, paused or playing; at least one takeback move; free analysis or `allowTakeback` |
| `actualTurnColour` | The live side to move while the game is ongoing and not paused; drives `PlayerPanel.active` |
| `showAnalysisMoves` | Free analysis, a finished game, or `gameplayOptions.showLiveAnalysisMoves` |

Board orientation selects which colour appears in the top and bottom player strips.

## Notes
- The events `GameView` still receives cross a real ownership boundary. `moveAttempted`, `premovesCancelled`, `moveSelected` and the three control events need the captured rendered-board owner, playback and continuation; history selection needs the same cancellation before navigation; the Menu events need the pause and its completion. A child calling the store directly would bypass that ordering ([component simplification plan, retained events](../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-events-concrete-justifications)).
- One clock timer, one turn projection and one captured-material traversal feed both player strips so the two displays cannot disagree.
- Temporary route changes preserve premove queues; only explicit tab close clears a queue (see [GameTabs](../Components/GameTabs.md)).
- The canonical `position` and premove `displayPosition` stay distinct: legality, analysis, saves and FEN use the canonical board; only artwork, accessible labels and off-turn candidates use the projection.
- No watcher, publication counter or separate presentation query layer is used.
