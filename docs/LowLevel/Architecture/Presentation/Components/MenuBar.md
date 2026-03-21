# MenuBar

## Purpose
Expose shell-level actions for new game, save, load, settings, and game lifecycle flows.

## Consumes
- active game availability
- current route
- `ActionButton` for consistent menu action rendering

## Emits
- `newGameRequested`
- `loadGameRequested`
- `saveGameRequested`
- `settingsRequested`
- `deleteGameRequested`

## Notes
- Save and load orchestration happens in stores and adapters, not in the component.
- Reusable action-button behaviour stays in the common component layer.
