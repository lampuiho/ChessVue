# SettingsView

Source: [`src/views/SettingsView.vue`](../../../../../src/views/SettingsView.vue) · Route: `/settings/:category` (`settings`)

## Purpose
Render user-editable settings by category, the engine overview, and the route shell for the engine-management child views.

## Inputs
- Accepted settings, the settings draft (`draftSettings`) and `hasPendingChanges` from `SettingsStore`.
- Package listing and capability from `EnginesStore` (`listPackages`, `refreshPackages`, `canInstallPackages`).
- The routed category (`session`, `gameplay`, `appearance` or `engines`) and whether an engine child route is matched.
- `UiStateStore.gameSession.activeGameId` for the return route.
- Children: `NavigationFrame`, `GamePlayerField`, `GameClockFields`, `AnalysisSnapshotFields`, `AppIcon`, a `RouterView` for engine child routes, and mounted `ConfirmationModal`s.
- Default theme profiles from `AppearanceConfig` for the theme previews.
- Styles: `settings.css`; fields, toggles and buttons from `shared.css`.

## Outputs
- `appearanceChanged` (no payload) after a successful Apply, Save or Reset. `App` handles it on the routed view and reapplies document appearance.
- `SettingsStore.applySettings`, `saveSettings`, `resetSettings` and `discardPendingSettings`.
- Draft edits: settings fields are bound directly to the draft; deleting an engine profile removes it from the draft inventory.
- Navigation to the engine child routes by route name, and back to the active game or `/home`.

## Notes
- The navigation frame holds *Back to game* or *Back to home*, the four category buttons and, in its footer, *Reset to defaults*. Categories navigate to `/settings/:category`; `/settings` redirects to `/settings/session`.
- The primary action row at the bottom right contains *Cancel*, *Save* and *Apply changes*. Save and Apply are disabled without pending changes or while game defaults are invalid. Save persists and returns; Apply persists and stays. The row is hidden while an engine child view is shown.
- Reset sits apart from the primary row and always asks for confirmation before defaults are restored.
- Leaving with pending changes, through Back, Cancel or any route leave, asks to discard them. `onBeforeRouteLeave` cancels the navigation and opens the confirmation; confirming discards the draft and navigates to the captured target.
- The unsaved badge in the content header reflects `hasPendingChanges`.
- Opening settings from a game may apply a Menu pause; that is `GameView`'s Menu interruption, not settings logic.
- **Session:** restore previous session, auto-pause on menu, save folder, autosave interval (0 disables) and save on close. Save on close is disabled while session restore is on.
- **Gameplay:** quick game defaults (see [Game defaults](#game-defaults)) and *After exploring history* (`analysisBranchExitBehaviour`).
- **Appearance:** theme mode with System, Light and Dark previews; board orientation; coordinates; last-move highlight; interface scale from 75% to 150% in 5% steps. Previews use runtime style bindings that supply only `--preview-*` custom-property values from the default profiles.
- **Engines:** installed browser engines (browser target only), *Resume after restore* (`analysis.resumeLiveAnalysisAfterRestore`) and engine profiles. Each profile row shows its name, location and interface (*Browser UCI Worker* or *Desktop executable*) with Copy, Edit and Delete icon buttons.
- Appearance effects use the `appearanceChanged` component event. Failed writes, draft changes and discard emit nothing. `App` installs the accepted policy and both palette banks; CSS follows later host-theme changes; no store listener, action hook or watcher drives these effects ([code cleanup plan](../../../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition)).
- **Planned:** board and piece theme selection. The reserved schema fields are preserved without controls in the initial phase.
- User-setting edits stay in the `SettingsStore` draft, including engine profiles, which are serialised in settings data. Applying or saving profile edits updates reusable profiles only; open games keep their copied launch configuration until the user explicitly reassigns them.

## Routed engine management
`SettingsView` stays mounted and renders engine child routes through a `RouterView` keyed by `route.fullPath`. [EngineProfileView](EngineProfile.md) owns new, edit and copy forms; [EnginePackageImportView](EnginePackageImport.md) owns name validation and immediate archive import; [EnginePackageDetailsView](EnginePackageDetails.md) lists files and current profile, default and game references. These are real routes, without an editor modal or hidden full-width state. Only file-removal confirmation uses `ConfirmationModal`.

On the browser target the engines category lists installed packages (bundled Stockfish and imported folders) with *Create profile* and *Details*, plus *Refresh* and *Install browser engine*. `_loadEnginePackages` runs on mount and on route updates into the engines category, sharing one pending read so repeated requests do not start duplicate discovery. The desktop target shows no package list.

Profile Add/Update changes the Settings draft; Apply or Save persists it. Import and removal change browser files immediately and rediscover folders. Desktop browsing points directly at existing executable or script files. See the [engine management UI design](../../../../ArchivedPlans/EngineManagementUiDesign.md) and [Router](../Router.md#nested-engine-routes).

## Game defaults
Gameplay edits the complete creation-request snapshot without `rootPosition`. Shared `GamePlayerField`, `GameClockFields` and `AnalysisSnapshotFields` render explicit Keep (saved configuration) and *Use profile* replacement choices, canonical clock presets and Custom minutes and increment, takebacks and the live-analysis moves preference. Profile choices come from the draft inventory, so a profile added in the same unsaved edit can be copied. *Use free analysis* unassigns both seats; *Manage engine profiles* opens the engines category without leaving the draft. A sentence explains whether the defaults start a live game or free analysis. Validation through `getGameCreationError` blocks Save and Apply without starting engines. Deleting a profile leaves copied defaults intact.

*Randomly assign colours* relabels the seats Player 1 and Player 2 and seeds both Quick and Custom creation. It is disabled unless both seats are assigned. Applying settings saves the preference without drawing colours. See the [quick game defaults design](../../../../ArchivedPlans/QuickGameDefaultsDesign.md).
