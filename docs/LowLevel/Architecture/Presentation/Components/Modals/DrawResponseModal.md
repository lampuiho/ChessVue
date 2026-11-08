# DrawResponseModal

Source: [`src/components/modals/DrawResponseModal.vue`](../../../../../../src/components/modals/DrawResponseModal.vue)

## Purpose
Ask the responding side of a local-versus-local game to accept or decline a draw offer.

## Interface
- Props: `gameId: string`; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Stores: `GamesStore` (`getGame`, `acceptDrawOffer`, `declineDrawOffer`).
- Composables: `useModalAction`.
- Children: `ModalDialog` (not dismissible).
- Styles: `dialogs.css`, `shared.css` buttons.

## Notes
- Setup captures the game and its current `drawOfferState`; the subtitle names the offer's `respondingColour`.
- The dialog can respond only while the store still holds that game and that exact offer. When it no longer can, it stops rendering and dismisses itself from `onMounted` or `onUpdated`, without a watcher. Accept and Decline recheck the same identity before calling the store.
- Escape, the backdrop and the close button are inert; only an explicit, successful response closes it.
- Opened by `GameControlPanel._offerDraw` after `offerDraw` succeeds and the offer confirmation is still live. Non-local offers never use this dialog.
- The identity check covers opening and submission only. `GamesStore.acceptDrawOffer` does not recheck the offer after awaiting turn cleanup, so this dialog makes no stronger guarantee for that store operation ([component simplification plan](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#1-remove-duplicated-modal-inputs-and-the-form-relay)).
