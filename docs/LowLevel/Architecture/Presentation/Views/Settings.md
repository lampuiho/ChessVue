# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- configured engine records from `SettingsStore` or `EnginesStore`

## Outputs
- save settings
- reset settings
- add, edit, and remove engine records

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
