# Shared Dialog Flows

## Purpose
Define the committed shared-dialog variants that sit on top of `ModalDialog` and `DialogButton`.

This document covers the dialog-hosted flows that do not need their own dedicated feature component like `NewGameModal`, while still requiring explicit ownership, payload, and action-row design.

## Rules
- `UiStateStore` owns the typed transient modal state, but the triggering feature or store still owns the underlying decision.
- `ModalDialog` owns shell markup only. Feature owners provide title, body intent, and action wiring.
- Dialog actions should stay shallow and map directly to one store boundary or one explicit dismiss path.
- Promotion may still use a board-local overlay; this document only covers the dialog-hosted variant.
- `newGame` remains owned by [Components/NewGameModal.md](Components/NewGameModal.md) rather than this shared flow table.

## Dialog Matrix
| Modal kind | Owning entry point | Title and body intent | Action row | Payload |
| --- | --- | --- | --- | --- |
| `AppModalKind.Promotion` | `Chessboard.moveSubmitted` after `GamesStore.makeMove` returns `MakeMoveResultKind.PromotionRequired` | Ask the user to choose the promotion piece for the pending move. | `Cancel` plus local `PiecePalette` choice actions. | `gameId`, pending `move` |
| `AppModalKind.PruneFuture` | `HistoryPanel` prune action | Confirm irreversible deletion of future moves from the selected node. | `Cancel` and danger `Prune`. | `gameId`, selected `node` |
| `AppModalKind.StartGameFromSetup` | `GameControlPanel.startGameFromSetupRequested` | Collect the live-game start details for a prepared setup workspace, including the per-game live-analysis move preference. | `Cancel` and primary `Start Game`. | `gameId` |
| `AppModalKind.Resign` | `GameControlPanel.resignRequested` | Confirm resignation for the selected side before finalising the result. | `Cancel` and danger `Resign`. | `gameId`, resigning `colour` |
| `AppModalKind.DrawOffer` | local-versus-local `GameControlPanel.drawRequested` | Confirm that the current local side wants to offer a draw. | `Cancel` and primary `Offer Draw`. | `gameId`, offering `colour` |
| `AppModalKind.DrawResolve` | local draw-response presentation branch after `GamesStore.offerDraw` | Ask the responding local side whether to accept or decline the outstanding draw offer. | `Decline` and primary `Accept`. | `gameId`, offering `colour`, responding `colour` |
| `AppModalKind.Timeout` | `GameView.onClockTick` or focus-return handling after `GamesStore.syncClock` records timeout | Explain that the game ended on time and identify the recorded timeout result. | Single acknowledge action. | `gameId`, `resultState`, `resultReason = ResultReason.Timeout` |
| `AppModalKind.ImportError` | `MenuBar.importGameRequested` after `GamesStore.loadGame` rejects the selected document | Explain that the selected file could not be imported because it is unsupported, corrupt, or incomplete. | Single acknowledge action. | `message` |
| `AppModalKind.ResetSettings` | `SettingsView.resetRequested` | Confirm reset of the pending settings draft back to defaults. | `Cancel` and danger `Reset`. | none |
| `AppModalKind.DeleteGame` | `GameTabs.deleteRequestedForActiveGame` or `GameTabs.deleteRequestedForInactiveGame` | Confirm permanent removal of the selected game before the store mutates tabs or active routing. | `Cancel` and danger `Delete`. | `gameId` |
| `AppModalKind.BoardEditBlocked` | `GameControlPanel.boardEditRequested` when board edit is not allowed | Explain that board editing belongs only to `WorkspaceKind.FreeAnalysisSetup`. | Dismiss-only for the baseline, with room for a later setup shortcut. | `gameId`, `reason` |
| `AppModalKind.SettingsDirtyLeave` | `SettingsView.returnRequested` with pending draft edits | Ask whether to discard or keep editing before leaving the settings route. | Secondary `Stay` and primary `Discard Changes`. | target route |
| `AppModalKind.AnalysisExitDirty` | `GameControlPanel.analysisExitRequested` with retained exploratory work | Ask whether to keep or discard the dirty analysis branch before restoring the live node. | Secondary `Keep Branch` and primary `Discard Branch`. | `gameId` |
| `AppModalKind.PlayerSelection` | `PlayerPanel.playerSelectionRequested` | Choose unassigned, `PlayerType.Local`, or a configured engine profile for one seat. | `Cancel` plus seat-selection actions. | `gameId`, seat `colour`, current player selection |
| `AppModalKind.AnalysisEngineSelection` | `AnalysisPanel.analysisEngineAddRequested` | Choose one unassigned engine profile to add to the current game's analysis roster. | `Cancel` and primary `Add Engine`. | `gameId`, current `assignedEngineIds` |

## Coverage Notes
- Draw flow is intentionally split into `AppModalKind.DrawOffer` and `AppModalKind.DrawResolve` so the baseline local-versus-local response step is visible in design.
- `AppModalKind.StartGameFromSetup` owns live-game-only choices gathered from a prepared setup workspace, including the persisted `showLiveAnalysisMoves` preference for the resulting live game.
- Non-local opponents skip the dialog-hosted response step and instead use the draw control's LED-like pending-offer indicator for any unresolved offer, where the lit state switches the next `Draw` press into `accept` for `DrawOfferDirection.Incoming` or `withdraw` for `DrawOfferDirection.Outgoing`.
- Timeout, dirty-exit, and blocked-action dialogs are notifications or confirmations only; they do not move business logic into presentation.
- `AppModalKind.ImportError` is acknowledge-only in the baseline because invalid import never exposes a recoverable-subset continuation flow.
- The same dialog shell keeps placement and action-row conventions consistent across gameplay, setup, settings, and lifecycle flows.
