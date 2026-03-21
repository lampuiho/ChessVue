# SettingsActionButton

## Purpose
Provide form and inventory action buttons within the settings workspace.

## Consumes
- role such as save, reset, add, edit, remove, or retry
- disabled, pending, and destructive state
- optional validation summary hint

## Emits
- `clicked`

## Notes
- `SettingsView` uses `SettingsActionButton` for preference and engine-inventory workflows.
- This family keeps settings actions visually distinct from menu-toolbar and side-panel controls.
