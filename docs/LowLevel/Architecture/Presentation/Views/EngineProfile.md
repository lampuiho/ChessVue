# EngineProfileView

Source: [`src/views/EngineProfileView.vue`](../../../../../src/views/EngineProfileView.vue)

## Purpose
Own the routed form that adds, edits or copies one reusable engine profile in the Settings draft.

## Routes
Rendered inside `SettingsView`'s `RouterView`:

| Route name | Path | Mode |
| --- | --- | --- |
| `engine-profile-new` | `/settings/engines/profiles/new` | Add; optional `packagePath` query names a package to choose an entry from |
| `engine-profile-edit` | `/settings/engines/profiles/:profileId/edit` | Edit the draft profile with that ID |
| `engine-profile-copy` | `/settings/engines/profiles/:profileId/copy` | Copy with a new ID and a unique name (`<name> copy`, `<name> copy 2`, …) |

## Dependencies
- Stores: `SettingsStore` (`loadSettings`, `draftSettings.analysis.engineInventory`), `EnginesStore` (`canInstallPackages`, `refreshPackages`, `listPackages`, `getPackage`, `browseEngineFile`).
- Config: `StockfishConfig.entryPath` for *Use included Stockfish*.
- Children: `AppIcon`.
- Styles: `settings.css` (`.engine-editor`, `.engine-heading`, `.option-list`); fields and buttons from `shared.css`.

## Behaviour
- `onMounted(_load)` initialises from the current draft, so direct URLs and reloads work without a preceding list click. A missing profile ID for edit or copy shows *Profile not found*. The view then refreshes package discovery; a discovery failure shows *Retry discovery* while the form stays editable.
- **Profile name** is required and must be unique among draft profiles.
- **Engine interface** selects *Desktop executable* (`EngineClientType.Uci`) or *Browser UCI Worker* (`EngineClientType.UciWorker`). On the browser target, where packages can be installed, desktop executables are disabled and a non-worker profile shows a relink message.
- On the browser target a worker profile chooses its **engine entry script** from files grouped by package, with no automatic choice; a `packagePath` hint names the package to look in. The path field stays editable on both targets.
- On the desktop target **Browse** opens the platform file picker through `EnginesStore.browseEngineFile`; cancelling the picker leaves the form unchanged. Worker profiles also offer **Use included Stockfish**.
- **Options** are free name/value rows. Blank names are dropped; `true`, `false` and numeric values are stored as booleans and numbers, everything else as text.
- **Add profile / Update profile** writes the record into the draft inventory and replaces the route with the engines overview. Apply or Save on Settings persists it. **Back to engines** and **Cancel** navigate to the overview and abandon only the local form.

## Notes
- The view starts no engine: it does not check file availability or read option metadata. Runtime errors surface when a game uses the profile.
- Open games keep their copied configuration; changing a profile does not rewrite existing assignments.
- See the [engine management UI design](../../../../ArchivedPlans/EngineManagementUiDesign.md#desktop-profile-form) for the desktop and browser form decisions.
