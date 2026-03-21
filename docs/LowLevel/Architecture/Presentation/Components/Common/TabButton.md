# TabButton

## Purpose
Provide the clickable tab element used by `TabbedView` for child-route switching.

## Consumes
- tab label
- active, closable, and disabled state
- optional dirty or status indicator

## Emits
- `selected`
- `closed`

## Notes
- `TabbedView` composes `TabButton` rather than defining tab-button behaviour inline.
- Route switching still happens at the `TabbedView` level.
