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
- `playerEngineSelectionRequested`

## Notes
- Gameplay actions such as pause, resign, draw, and takeback are centralised in `GameControlPanel`.
- Captured material is rendered as grouped icons in the player strip rather than as a separate control surface.
- `PlayerPanel` stays read-heavy, but an engine-controlled seat exposes its displayed engine profile name as the explicit click target for changing that seated engine.
- Keeping `PlayerPanel` display-focused outside that explicit seat-change affordance reduces duplicated controls and unnecessary template depth.
- `PlayerPanel` contains no HTML or template markup and binds player state into `PanelSurface`, `StatusCard`, and `ClockDisplay`.
