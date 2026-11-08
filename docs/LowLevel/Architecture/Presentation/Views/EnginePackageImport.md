# EnginePackageImportView

Source: [`src/views/EnginePackageImportView.vue`](../../../../../src/views/EnginePackageImportView.vue) · Route: `/settings/engines/packages/import` (`engine-package-import`)

## Purpose
Import a ZIP engine package into browser storage under a user-chosen, unique folder name. Rendered inside `SettingsView`'s `RouterView`.

## Dependencies
- Store: `EnginesStore` (`canInstallPackages`, `refreshPackages`, `listPackages`, `readArchive`, `installPackage`).
- Async: one `OperationOwner` for the file read or install, plus one shared pending discovery promise.
- Children: `AppIcon`.
- Styles: `settings.css` (`.engine-editor`, `.engine-package-files`); fields and buttons from `shared.css`.

## Behaviour
- On a target that cannot install packages (desktop), the view explains that desktop profiles point directly at an executable or unpacked script.
- `onMounted` runs its own package discovery, so the route works from a direct URL. *Install engine* stays disabled until discovery succeeds; a failure shows the error and *Refresh folders*.
- **Engine name** is validated in the view: required, no reserved characters, no trailing space or dot, not a reserved device name, and unique (case-insensitive) among discovered packages.
- **Choose engine archive** reads the selected ZIP with `EnginesStore.readArchive` inside the operation owner and lists its files. Choosing another file replaces the previous read.
- **Install engine** calls `EnginesStore.installPackage(name, archive, signal)`. Files keep their original names and relative layout; no entry or interface is chosen here. On success the view offers *Done* and *Create profile* (the new-profile route with a `packagePath` query). If the files were saved but the folder refresh failed, it keeps the saved path and offers *Refresh folders* before profile creation.
- `onBeforeRouteLeave` and `onBeforeRouteUpdate` settle the file action first: a read is cancelled, while an install that has started is awaited, so navigation never abandons a half-published package. `onBeforeUnmount` disposes the owner.

## Notes
- Import changes browser files immediately and independently of the Settings draft. Apply, Save or Discard on Settings do not undo it.
- See the [engine management UI design](../../../../ArchivedPlans/EngineManagementUiDesign.md#browser-import).
