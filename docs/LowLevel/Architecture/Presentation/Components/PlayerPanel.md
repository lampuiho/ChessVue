# PlayerPanel

## Purpose
Render player slots, clock state, and engine status for both sides.

## Consumes
- player-slot data
- clock snapshot
- engine availability for assigned engines
- `PanelSurface` for shared panel layout

## Emits
- none directly

## Notes
- Gameplay actions such as pause, resign, draw, and takeback are centralised in `GameControlPanel`.
- Keeping `PlayerPanel` display-focused reduces duplicated controls and unnecessary template depth.
- `PlayerPanel` contains no HTML or template markup and binds player state into `PanelSurface`, `StatusCard`, and `ClockDisplay`.
