# MenuBar

## Purpose
Expose shell-level actions for new game, save, load, settings, and game lifecycle flows.

## Consumes
- active game availability
- current route
- `MenuToolbarButton` for consistent menu action rendering

## Emits
- `quickNewGameRequested`
- `customNewGameRequested`
- `loadGameRequested`
- `saveGameRequested`
- `settingsRequested`
- `deleteGameRequested`

## Notes
- Save and load orchestration happens in stores and adapters, not in the component.
- Reusable menu-toolbar button behaviour stays in the common component layer.
- Distinguishing quick-new from custom-new keeps the menu aligned with the committed scenario entry points.
