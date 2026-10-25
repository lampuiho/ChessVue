# SettingsView

## Purpose
Render user-editable settings and engine inventory management.

## Inputs
- settings snapshot from `SettingsStore`
- settings draft snapshot from `SettingsStore`
- appearance projection from `SettingsStore`
- configured engine records and cached option metadata from `EnginesStore`
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
- emit `appearanceChanged` after successful Apply, Save or Reset; App handles it to update document appearance
- add, copy, edit, remove, and refresh metadata for engine profiles through `EnginesStore`

## Notes
- Opening settings may trigger menu-driven auto-pause through store coordination, not view logic.
- `SettingsView` switches between settings categories through a tab-style control that maps to `/settings/:category` rather than presenting all categories in one long page.
- The baseline settings categories are `session`, `gameplay`, `appearance`, and `engines`, with `/settings` redirecting to `/settings/session`.
- The appearance category chooses the colour-scheme policy and includes layout-related presentation preferences such as `uiScalePercent`, `boardOrientation`, `showCoordinates`, and `highlightLastMove`.
- Theme-profile selection is not exposed by the baseline settings view. Its previews consume the same configured readonly profiles as the root appearance projection.
- Appearance effects use the view's `appearanceChanged` component event. Failed writes, draft changes and discard emit nothing. App listens to the routed SettingsView and installs the accepted policy and both palette banks; CSS follows later host-theme changes; no store listener registry, action hook or watcher drives these effects.
- Board and piece theme selection is also deferred. Preserve the reserved schema fields without exposing controls for them in the initial phase.
- The engines category contains both `analysis.resumeLiveAnalysisAfterRestore` and engine inventory fields.
- User-setting edits stay in the `SettingsStore` draft; engine-profile configuration remains owned separately by `EnginesStore` even though profiles are serialised in settings data.
- Inside the engines category, each engine-profile row shows the profile name on the left and icon buttons for copy, edit, and delete on the right.
- Editing a profile opens a dedicated profile editor surface with general fields plus an options name/value table informed by `EnginesStore` cached metadata. Refreshing that metadata runs and closes a temporary engine without altering saved option values.
- Applying or saving engine-profile edits updates reusable profiles only. Existing copied engine payloads inside open games keep their current launch configuration until the user explicitly swaps them.
- The primary settings action row sits at the bottom-right of the settings surface and contains `Cancel`, `Save`, and `Apply`.
- `Reset` stays outside that primary row in a separate secondary settings action area and always routes through a confirmation dialog before defaults are restored.
- `SettingsView` contains no HTML or template markup and delegates rendering to common form and list components.

## Routed engine management

SettingsView remains mounted and renders engine child routes through RouterView. EngineProfileView owns new/edit/copy forms, EnginePackageImportView owns frontend name validation and immediate archive import, and EnginePackageDetailsView lists files and current profile/game references. These are real routes, without an editor modal or hidden full-width modal state. Only file-removal confirmation uses ConfirmationModal.

Profile save changes the Settings draft; Apply/Save persists it. Import/removal changes browser files immediately and rediscovers folders. Desktop browsing points directly at existing executable/script files. See [routes and UI function flows](../../../../EngineManagementUiDesign.md).
