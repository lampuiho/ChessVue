# PlayerPanel

Source: [`src/components/PlayerPanel.vue`](../../../../../src/components/PlayerPanel.vue)

## Purpose
Render one colour's player strip: avatar, name and player chooser, engine status, captured material and clock.

## Interface
- Props: `colour: PlayerColour`; `gameId: string`; `remainingMs?: number`; `active?: boolean`; `selectionDisabled?: boolean`; `capturedPieces?: readonly ICapturedPieceGroup[]`.
- Emits: none. Slots: none.

## Dependencies
- Stores: `GamesStore.getGame` for the colour's player and its shallow-reactive engine runtime.
- Composables: `useModal`.
- Children: `ChessPiece`, `AppIcon`; mounted `PlayerSelectionModal`.
- Styles: `player.css` (`.player-panel`, `.player-name`, `.engine-state`, `.captured-pieces`, `.player-clock`, `.engine-error--player`).

## Notes
- The name button opens `PlayerSelectionModal` with `gameId` and `colour`. It is enabled unless the game is in board edit or `selectionDisabled` (the view's playback lock) is set; genuine pauses still permit reassignment. The modal captures its initial player, so Keep preserves an existing copied engine even if its profile has changed.
- The meta line shows the colour and *Local player*, *Analysis seat* (unassigned) or the engine's availability. An engine `lastError` replaces the meta line with an alert beside the affected seat.
- The clock shows `—` when untimed, minutes and seconds otherwise, and tenths below ten seconds. `active` lights the avatar and running clock.
- Captured pieces are drawn in the captured colour, with overlapping repeats.
- `GameView` keeps one clock timer, the actual live-turn projection and one captured-material traversal for both strips and passes `remainingMs`, `active` and `capturedPieces`, so the two strips agree with a single source. `active` follows actual play rather than the side to move on a historical or analysis board ([component simplification plan, retained props](../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-props-and-slots-concrete-justifications)). Board orientation selects which colour appears in each strip.
- Gameplay controls stay in `GameControlPanel`. The earlier `ClockDisplay` and `StatusCard` primitives were never implemented; the clock and status markup live here.
