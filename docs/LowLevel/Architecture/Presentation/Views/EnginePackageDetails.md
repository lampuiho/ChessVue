# EnginePackageDetailsView

Source: [`src/views/EnginePackageDetailsView.vue`](../../../../../src/views/EnginePackageDetailsView.vue) · Route: `/settings/engines/packages/details?packagePath=…` (`engine-package-details`)

## Purpose
Show one engine package folder, its files and everything that references it, and remove an unreferenced imported package. Rendered inside `SettingsView`'s `RouterView`.

## Dependencies
- Stores: `EnginesStore` (`getPackage`, `refreshPackages`, `removePackage`, `canInstallPackages`), `SettingsStore` (`loadSettings`, accepted `settings` and `draftSettings`), `GamesStore.listGames`.
- Utility: `getGameEngineUsage` for game-default references.
- Children: `AppIcon`; mounted `ConfirmationModal`.
- Styles: `settings.css` (`.engine-editor`, `.engine-package-files`).

## Behaviour
- `onMounted(_load)` loads settings and refreshes packages, so a direct URL works. A failure offers *Refresh folders*; an unknown `packagePath` shows *Engine folder not found*.
- The page shows the folder name, its source (*Included with ChessVue* or *Imported package*), any warning and its file list.
- **References** lists every browser-worker entry path under the folder from accepted and draft game defaults, accepted and draft profiles, open games' engine players and open games' analysis seats.
- **Create profile** opens the new-profile route with this `packagePath`.
- **Remove files** appears only for imported user packages on the browser target. It opens a `ConfirmationModal` with `dismissibleWhileWorking: false`; confirming calls `EnginesStore.removePackage(packagePath, _readReferences)`, which rereads references when the queued removal starts and refuses a referenced package, then returns to the engines overview. Profiles and games are never deleted or retargeted automatically.

## Notes
- A draft-only profile deletion still counts as a reference until it is applied, because accepted settings are checked too.
- See the [engine management UI design](../../../../ArchivedPlans/EngineManagementUiDesign.md#browser-details-removal-and-recovery).
