# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- configured engine records from `SettingsStore` or `EnginesStore`
- `SettingsActionButton` for settings and engine-inventory actions

## Outputs
- save settings
- reset settings
- add, edit, and remove engine records

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
