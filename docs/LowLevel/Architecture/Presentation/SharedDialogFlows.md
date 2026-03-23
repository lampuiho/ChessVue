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
| `promotion` | `GamesStore.makeMove` when promotion selection is required | Ask the user to choose the promotion piece for the pending move. | `Cancel` plus local `PiecePalette` choice actions. | `gameId`, pending `move` |
| `pruneFuture` | `HistoryPanel` prune action | Confirm irreversible deletion of future moves from the selected node. | `Cancel` and danger `Prune`. | `gameId`, `nodeId` |
| `startGameFromSetup` | `GameControlPanel.startGameFromSetupRequested` | Collect the live-game start details for a prepared setup workspace. | `Cancel` and primary `Start Game`. | `gameId` |
| `resign` | `GameControlPanel.resignRequested` | Confirm resignation for the selected side before finalising the result. | `Cancel` and danger `Resign`. | `gameId`, resigning `colour` |
| `drawOffer` | local-versus-local `GameControlPanel.drawRequested` | Confirm that the current local side wants to offer a draw. | `Cancel` and primary `Offer Draw`. | `gameId`, offering `colour` |
| `drawResolve` | opposing-local-side branch after `GamesStore.offerDraw` | Ask the responding local side whether to accept or decline the outstanding draw offer. | `Decline` and primary `Accept`. | `gameId`, offering `colour`, responding `colour` |
| `timeout` | `GamesStore.syncClock` timeout finalisation | Explain that the game ended on time and identify the recorded timeout result. | Single acknowledge action. | `gameId`, `resultState`, `resultReason = timeout` |
| `importError` | invalid or recoverable load path | Explain the import failure and optionally allow continuing with the recoverable subset. | Acknowledge only, or `Cancel` plus primary `Continue` when recovery is possible. | `message`, `isRecoverable` |
| `resetSettings` | `SettingsView.onReset` | Confirm reset of the pending settings draft back to defaults. | `Cancel` and danger `Reset`. | none |
| `deleteGame` | delete active or inactive game flow | Confirm permanent removal of the selected game before the store mutates tabs or active routing. | `Cancel` and danger `Delete`. | `gameId` |
| `boardEditBlocked` | blocked board-edit attempt from in-game analysis | Explain that board editing belongs only to `freeAnalysisSetup`. | Dismiss-only for the baseline, with room for a later setup shortcut. | `gameId`, `reason` |
| `settingsDirtyLeave` | navigation away from settings with unsaved draft edits | Ask whether to discard or keep editing before leaving the settings route. | Secondary `Stay` and primary `Discard Changes`. | target route |
| `analysisExitDirty` | exit from in-game analysis with retained exploratory work | Ask whether to keep or discard the dirty analysis branch before restoring the live node. | Secondary `Keep Branch` and primary `Discard Branch`. | `gameId` |
| `playerSelection` | `PlayerPanel.playerSelectionRequested` | Choose `none`, `local`, or a configured engine profile for one seat. | `Cancel` plus seat-selection actions. | `gameId`, seat `colour`, current player selection |
| `analysisEngineSelection` | `AnalysisPanel.analysisEngineAddRequested` | Choose one unassigned engine profile to add to the current game's analysis roster. | `Cancel` and primary `Add Engine`. | `gameId`, current `assignedEngineIds` |

## Coverage Notes
- Draw flow is intentionally split into `drawOffer` and `drawResolve` so the baseline local-versus-local response step is visible in design.
- Non-local opponents skip the dialog-hosted response step and instead use the draw control's LED-like pending-offer indicator for incoming offers, where the lit state switches the next `Draw` press into an immediate accept action.
- Timeout, dirty-exit, and blocked-action dialogs are notifications or confirmations only; they do not move business logic into presentation.
- The same dialog shell keeps placement and action-row conventions consistent across gameplay, setup, settings, and lifecycle flows.
