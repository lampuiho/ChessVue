# EngineInventoryEditor

## Purpose
Render the engine-inventory list and edit surface inside settings.

## Consumes
- configured engine records
- cached discovered option metadata for the selected profile
- validation state for the active editor
- available settings actions
- per-profile copy, edit, and delete actions
- editable option rows for the selected profile

## Emits
- `engineAddRequested`
- `engineCopyRequested`
- `engineEditRequested`
- `engineRemoveRequested`
- `engineOptionRowAdded`
- `engineOptionRowUpdated`
- `engineOptionRowRemoved`
- `engineOptionMetaRefreshRequested`

## Notes
- `SettingsView` delegates engine-specific list and edit markup to this component.
- The profile list uses one row per engine profile with the name on the left and icon-only `copy`, `edit`, and `delete` actions aligned on the right.
- The profile editor presents general profile fields plus a simple options table with one row per option name/value pair.
- Option metadata is loaded through `EnginesStore` for rendering appropriate profile controls. The saved option map remains authoritative and is not reconciled during discovery.
- `EngineInventoryEditor` can compose `SettingsSection`, `ItemList`, `FieldRow`, and `SettingsActionButton`.
- `EngineInventoryEditor` contains no HTML or template markup and adapts engine-inventory workflows into common form, list, and message components.
