# HomeView

## Purpose
Render the neutral landing screen for launch, no-active-game fallback, and first-use actions.

## Inputs
- session restore outcome from `UiStateStore`
- available actions from `GamesStore`
- `HomeMenuButton` for landing-page actions

## Outputs
- quick new game action
- open custom new game modal
- load game action
- open settings action

## Notes
- `HomeView` does not auto-create a game on its own.
- `HomeView` contains no HTML or template markup and delegates rendering to common components.
