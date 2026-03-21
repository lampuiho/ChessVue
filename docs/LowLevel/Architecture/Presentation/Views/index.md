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
- Views contain no HTML or template markup.
- Views should remain thin coordinators that delegate all rendering to common components through template-free feature adapters.
