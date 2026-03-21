# Router

## Purpose
Define the baseline route map and route-guard responsibilities for the desktop shell.

## Routes
- `/home`
- `/game/:id`
- `/settings`

## Responsibilities
- route startup to home or restored session target
- reject invalid `/game/:id` routes and redirect to a valid fallback
- preserve the active game route when leaving and returning from settings

## Dependencies
- `UiStateStore`
- `GamesStore`

## Notes
- The router does not load or mutate game data directly.
- `GameView` is the only baseline game workspace screen.
