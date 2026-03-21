# ModalDialog

## Purpose
Provide a reusable dialog shell for confirmation, form, and interruption flows.

## Consumes
- title
- body content
- primary and secondary actions
- dismissibility rules

## Emits
- `confirmed`
- `cancelled`
- `dismissed`

## Notes
- `NewGameModal` and confirmation prompts should use the same dialog shell.
- Dialog actions inside the shell use `DialogButton`.
- Modal visibility remains transient UI state owned outside the dialog component.
