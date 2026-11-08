# PlayerSelectionModal

Source: [`src/components/modals/PlayerSelectionModal.vue`](../../../../../../src/components/modals/PlayerSelectionModal.vue)

## Purpose
Reassign one colour's seat in an open game.

## Interface
- Props: `gameId: string`; `colour: PlayerColour`; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Stores: `GamesStore` (`getGame`, `reassignPlayer`), `EnginesStore.listConfiguredEngines` (accepted profiles).
- Composables: `useModalAction`.
- Children: `ModalDialog`.
- Styles: `dialogs.css` (`.choice-list`, `.choice-card`).

## Notes
- Choices: *Keep `<engine>`* (only when the seat holds an engine), *Unassigned* (turns the game into free analysis), *Local player*, and one choice per configured engine profile.
- The opening captures the seat's initial player when it mounts and preselects Keep, Local or Unassigned from it. Later store publications do not reset the user's choice.
- Keep submits nothing, so a copied engine assignment and its options survive even if the source profile has changed or been deleted. Other choices call `GamesStore.reassignPlayer(game, colour, player)`; a profile without an entry path is rejected inline.
- Opened by `PlayerPanel`, which disables the chooser during board edit and playback; genuine pauses still permit reassignment.
- The `currentPlayer` prop was removed; the modal resolves its own seat from `gameId` and `colour` ([component simplification plan](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#1-remove-duplicated-modal-inputs-and-the-form-relay)).
