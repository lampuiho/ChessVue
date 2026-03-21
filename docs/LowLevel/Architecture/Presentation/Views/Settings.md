# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- configured engine records from `SettingsStore` or `EnginesStore`
- `SettingsActionButton` for settings and engine-inventory actions
- `FormSection` and `FieldRow` for shallow form structure
- `SettingsSection` and `EngineInventoryEditor` for self-contained settings subsections

## Outputs
- save settings
- reset settings
- add, edit, and remove engine records

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
- `SettingsView` contains no HTML or template markup and delegates rendering to common form and list components.
