# EngineInventoryEditor

## Purpose
Render the engine-inventory list and edit surface inside settings.

## Consumes
- configured engine records
- validation state for the active editor
- available settings actions

## Emits
- `engineAddRequested`
- `engineEditRequested`
- `engineRemoveRequested`
- `engineRetryRequested`

## Notes
- `SettingsView` delegates engine-specific list and edit markup to this component.
- `EngineInventoryEditor` can compose `SettingsSection`, `ItemList`, `FieldRow`, and `SettingsActionButton`.
- `EngineInventoryEditor` contains no HTML or template markup and adapts engine-inventory workflows into common form, list, and message components.
