# GameResultModal

Source: [`src/components/modals/GameResultModal.vue`](../../../../../../src/components/modals/GameResultModal.vue)

## Purpose
Announce a finished game's result and offer the next step.

## Interface
- Props: `gameId: string`; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Stores: `GamesStore` (`getGame`, `refreshAnalysis`).
- Composables: `useGameTabActions`, `useModalAction`; router for navigation.
- Children: `ModalDialog` (not dismissible), `AppIcon`.
- Styles: `dialogs.css` (`.result-actions`, `.modal-copy--result`), `shared.css` (`.action-card`).

## Notes
- The game is captured when the dialog mounts. The sentence combines the result (*White wins*, *Black wins*, *Draw* or *Game abandoned*) with its reason (*by checkmate*, *by stalemate*, *by insufficient material*, *on time*, *by resignation*, *by agreement*).
- **Exit** dismisses, then closes the game's tab with `useGameTabActions.close`, which navigates to another open game or Home.
- **Start analysis** awaits `GamesStore.refreshAnalysis` through `useModalAction` and dismisses on success, leaving the user on the finished game where analysis moves are playable.
- **Save for analysis** dismisses, then navigates to `/saved-games/save/:gameId`.
- The dialog cannot be dismissed by Escape, the backdrop or a close button; the user chooses one of the three actions.
- `GameView._reconcileGameEnd` opens it once per armed result notification, for every result reason including timeout. The store arms the notification when a result is recorded; the view consumes it on its clock tick.
