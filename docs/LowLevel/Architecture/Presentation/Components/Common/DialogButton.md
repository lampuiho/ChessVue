# DialogButton

## Purpose
Provide action buttons for modal and confirmation flows.

## Consumes
- role such as primary, secondary, confirm, cancel, or danger
- disabled and loading state
- optional submit intent

## Emits
- `clicked`

## Notes
- `ModalDialog` and `GameCreationModal` use `DialogButton`.
- Keyboard-default and escape/cancel expectations belong to this button family.
