# ActionButton

## Purpose
Provide a reusable button primitive for toolbar, menu, dialog, and panel actions.

## Consumes
- label or icon content
- visual variant such as primary, secondary, danger, or ghost
- disabled and loading state
- optional keyboard shortcut hint

## Emits
- `clicked`

## Notes
- `MenuBar`, `GameControlPanel`, and `NewGameModal` use `ActionButton` rather than defining bespoke button behaviour.
- Confirmation rules still live in the owning view or store flow.
