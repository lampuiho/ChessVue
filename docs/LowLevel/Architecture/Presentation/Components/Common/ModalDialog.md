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
- `NewGameModal`, confirmation prompts, invalid-load errors, and blocked board-edit explanations should use the same dialog shell.
- Exceptional runtime errors may also reuse this shell through `RuntimeErrorDialogMountUtility`, even though that path is not part of the ordinary typed shared-dialog matrix.
- Dialog actions inside the shell use `DialogButton`.
- Modal visibility remains transient UI state owned outside the dialog component.
- Shared dialogs are activated through `UiStateStore.showModal`, which creates fresh form state and owns cancellation/completion. `ModalHost` binds that form directly; no observer initialises it. Dismissal aborts pending delivery and completes the captured callback once, including Escape/backdrop cancellation where enabled.
