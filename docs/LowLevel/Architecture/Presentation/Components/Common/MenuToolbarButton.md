# MenuToolbarButton

## Purpose
Provide toolbar buttons for top-level menu actions such as new game, load, save, settings, and delete.

## Consumes
- icon or label content
- active, disabled, and danger state
- optional shortcut hint

## Emits
- `clicked`

## Notes
- `MenuBar` uses `MenuToolbarButton` instead of a generic shared button primitive.
- Toolbar layout, overflow, and shortcut display are part of this button family.
