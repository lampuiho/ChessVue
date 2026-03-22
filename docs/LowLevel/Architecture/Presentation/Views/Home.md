# HomeView

## Purpose
Render the neutral landing screen for launch, no-active-game fallback, first-use actions, and recent-game reopening.

## Inputs
- session restore outcome from `UiStateStore`
- available actions from `GamesStore`
- recent game references from `UiStateStore`
- `HomeMenuButton` for landing-page actions
- `ItemList` for recent game entries when present

## Outputs
- quick new game action
- open custom new game modal
- load game action
- open settings action
- open recent game action

## Notes
- `HomeView` does not auto-create a game on its own.
- The landing surface centres its content vertically as much as practical for the available space.
- Quick new, custom new, load, and settings render as one single row of large square icon-first buttons so the targets remain easy to click.
- A recent games list sits below the button row and is hidden when no recent entries exist.
- When the recent games list is hidden, the primary button row recentres within the home surface.
- `HomeView` contains no HTML or template markup and delegates rendering to common components.
