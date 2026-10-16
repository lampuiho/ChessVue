# PlayerPanel

## Purpose
Render player slots, clock state, and engine status for both sides.

## Consumes
- player-slot data
- clock snapshot
- engine availability for assigned engines
- captured piece groups derived for the player strips
- `PanelSurface` for shared panel layout

## Emits
- `playerSelectionRequested`

## Notes
- Gameplay actions such as pause, resign, draw, and takeback are centralised in `GameControlPanel`.
- Captured material is rendered as grouped icons in the player strip rather than as a separate control surface.
- Player engine runtime is shallow reactive in the state layer. The panel tracks availability and error fields directly; a failed engine displays its error beside that seat while reassignment remains available.
- `PlayerPanel` stays read-heavy, but each displayed player label for a baseline reassignable seat acts as the explicit click target for reassigning that side to unassigned, `PlayerType.Local`, or a configured engine profile. This reassignment affordance remains available while paused because it is treated as a game-configuration change rather than gameplay input.
- Keeping `PlayerPanel` display-focused outside that explicit player-reassignment affordance reduces duplicated controls and unnecessary template depth.
- `PlayerPanel` contains no HTML or template markup and binds player state into `PanelSurface`, `StatusCard`, and `ClockDisplay`.
