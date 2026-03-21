# HomeMenuButton

## Purpose
Provide the prominent action buttons used by the home screen entry menu.

## Consumes
- label
- icon or illustration
- emphasis variant for primary and secondary home actions
- optional helper text

## Emits
- `clicked`

## Notes
- `HomeView` uses `HomeMenuButton` for launch actions such as new game, load game, and settings.
- This family owns the larger landing-screen treatment rather than reusing toolbar or dialog button styling.
