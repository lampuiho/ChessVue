# ModalDialog

## Purpose
Provide a reusable dialog shell for confirmation, form, and interruption flows.

## Consumes
- title
- body content
- primary and secondary actions
- dismissibility rules

## Emits
- `dismissed`

## Notes
- `NewGameModal`, confirmation prompts, invalid-load errors, and blocked board-edit explanations should use the same dialog shell.
- Exceptional runtime errors may also reuse this shell through `RuntimeErrorDialogMountUtility`, even though that path is not part of the ordinary typed shared-dialog matrix.
- Feature components supply the actions slot using shared button classes.
- Modal visibility remains transient UI state owned outside the dialog component.
- Shared dialogs mount through `useModal().open(Component, props, onClosed?)`. Each opening owns its container, abort signal and captured completion; each component owns fresh local form state. Dismissal aborts delivery and completes its callback once, including permitted Escape/backdrop cancellation. The app context is preserved without another Vue app or an observer.
