# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- configured engine records from `SettingsStore` or `EnginesStore`
- shared tab state for settings-category switching
- `TabbedView` and `TabButton` for top-level settings categories
- `SettingsActionButton` for settings and engine-inventory actions
- `FormSection` and `FieldRow` for shallow form structure
- `SettingsSection` and `EngineInventoryEditor` for self-contained settings subsections

## Outputs
- cancel settings changes
- save settings
- apply settings without leaving the view
- reset settings
- add, edit, and remove engine records

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
- `SettingsView` switches between settings categories through a tab-style control rather than presenting all categories in one long page.
- The primary settings action row sits at the bottom-right of the settings surface and contains `Cancel`, `Save`, and `Apply`.
- `SettingsView` contains no HTML or template markup and delegates rendering to common form and list components.
