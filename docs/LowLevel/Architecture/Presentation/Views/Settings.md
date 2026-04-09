# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- settings draft snapshot from `SettingsStore`
- appearance projection from `SettingsStore`
- configured engine records from `SettingsStore` and runtime availability from `EnginesStore` where needed
- active routed settings category
- `TabbedView` and `TabButton` for top-level settings categories
- `SettingsActionButton` for settings and engine-inventory actions
- `FormSection` and `FieldRow` for shallow form structure
- `SettingsSection` and `EngineInventoryEditor` for self-contained settings subsections

## Outputs
- cancel settings changes
- save settings
- apply settings without leaving the view
- reset settings
- stage add, copy, edit, and remove engine profiles in the settings draft

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
- `SettingsView` switches between settings categories through a tab-style control that maps to `/settings/:category` rather than presenting all categories in one long page.
- The baseline settings categories are `session`, `gameplay`, `appearance`, and `engines`, with `/settings` redirecting to `/settings/session`.
- The appearance category includes both visual theme settings and layout-related presentation preferences such as `uiScalePercent`, `boardOrientation`, `showCoordinates`, and `highlightLastMove`.
- The engines category contains both `analysis.resumeLiveAnalysisAfterRestore` and engine inventory fields.
- Engine inventory edits stay inside the same pending settings draft as all other settings until the user applies, saves, or cancels them.
- Inside the engines category, each engine-profile row shows the profile name on the left and icon buttons for copy, edit, and delete on the right.
- Editing a profile opens a dedicated profile editor surface with general fields plus an options name/value table for supported engine options.
- Applying or saving engine-profile edits updates reusable profiles only. Existing copied engine payloads inside open games keep their current launch configuration until the user explicitly swaps them.
- The primary settings action row sits at the bottom-right of the settings surface and contains `Cancel`, `Save`, and `Apply`.
- `Reset` stays outside that primary row in a separate secondary settings action area and always routes through a confirmation dialog before defaults are restored.
- `SettingsView` contains no HTML or template markup and delegates rendering to common form and list components.
