# Views

## Baseline Views
- [HomeView](Home.md)
- [GameView](Game.md)
- [SettingsView](Settings.md)

## Supporting Map
- [Interaction Map](../InteractionMap.md)

## Rules
- Views compose store state into screens.
- Views do not implement business rules that belong to domain services or state stores.
- Views should remain thin coordinators that delegate layout-heavy and interaction-heavy markup to named components.
