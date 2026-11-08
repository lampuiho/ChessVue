# SettingsStore

## Purpose
Own the accepted user-settings snapshot as readonly state, the editable settings draft shared by the Settings routes, and the appearance projection for the committed UI.

## Public Interface
```ts
settings: DeepReadonly<ISettingsSnapshot> | undefined
draftSettings: ISettingsSnapshot | undefined
appearanceProjection: IAppearanceProjection | undefined
hasPendingChanges: boolean
recoveryWarning: string
loadSettings(): Promise<void>
updateSettings(patch: Partial<ISettingsSnapshot>): void
applySettings(): Promise<void>
discardPendingSettings(): void
saveSettings(): Promise<void>
resetSettings(): Promise<void>
```

The members appear in the order the store (`useSettingsStore`, store id `settingsStore`) returns them. `settings`, `appearanceProjection` and `hasPendingChanges` are computed; `draftSettings` and `recoveryWarning` are refs.

## Responsibilities
- lazily load and expose the accepted settings snapshot as readonly state for the app shell, views, composables and modals
- keep one draft settings snapshot separate from the accepted snapshot so apply, save, discard and reset flows are deterministic
- commit accepted settings changes through `UserSettingService` instead of owning raw settings-file access directly
- surface the settings load-recovery warning reported by `UserSettingService`
- expose the accepted `appearance.themeMode` policy for CSS to apply
- build the presentation-safe appearance projection, including the light and dark profile snapshots, and keep it reactive when accepted settings change

## Dependencies
- `UserSettingService`
- shared private utilities: `copyGameRequest` (`GameCreationUtility`) and the default theme profiles in `AppearanceConfig`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-NAV-01`
- `SCN-SAVE-01`
- `SCN-SAVE-02`
- `SCN-SETTINGS-01`
- `SCN-SETTINGS-02`

## Notes
- `SettingsStore` consumes `UserSettingService` for accepted settings reads and writes; it does not resolve `IPlatformService`, `StorageAdapter` or `SystemThemeAdapter` directly, and it does not call sibling stores.
- `loadSettings()` is the lazy single-flight accepted-settings boundary. `App` awaits it during startup alongside `UiStateStore` loading, and the engine-management views await it again on direct entry. It reads `UserSettingService.getSettingsOrDefault()`, copies `getLoadWarning()` into `recoveryWarning`, stores the accepted snapshot in a shallow ref exposed through the readonly `settings` computed, and creates an independent deep-reactive `draftSettings`.
- `draftSettings` lives in the store rather than a view so that one draft survives switching between `/settings/:category` routes and the nested engine-management routes. `EngineProfileView` edits `draftSettings.analysis.engineInventory` directly before returning to Settings, and `EnginePackageDetailsView` includes draft profiles and game defaults in its removal references. **Why:** view-local drafts would be lost or diverge as the user moves between categories and routed child views before Apply or Save; one store-owned draft gives Apply, Save, Discard and the dirty indicator a single source.
- `draftSettings` supports direct nested form mutation; `updateSettings(...)` remains available for programmatic patches and merges each top-level branch shallowly. `hasPendingChanges` compares the JSON of the draft and the accepted snapshot.
- `applySettings()` and `saveSettings()` share one persistence path: await `loadSettings()`, pass the raw draft to `UserSettingService.saveSettings(...)`, then accept the returned snapshot and rebuild the draft from it. `resetSettings()` follows the same acceptance path with `UserSettingService.resetSettings()`. `discardPendingSettings()` rebuilds the draft from the accepted snapshot.
- Accepted settings and the draft never share mutable branches because the draft may temporarily be invalid. `_cloneSettings` copies each settings branch, `gameDefaults` through `copyGameRequest` (players, assigned engines and option maps, clock and analysis profiles), and every engine-inventory record with its option map. A failed validation or write leaves accepted settings unchanged and retains the edited draft. **Why:** the accepted-to-draft copy is the intentional ownership boundary; ordinary draft edits do not clone state.
- `appearanceProjection` is computed from accepted settings and exposes both palettes without resolving the OS theme. Draft appearance changes do not affect app chrome until Apply, Save or Reset succeeds; `SettingsView` then emits `appearanceChanged`, which `App` handles to update document CSS variables and meta tags. CSS `color-scheme` and `light-dark()` select the active palette, and the store neither queries nor subscribes to system-theme changes.
- Theme profiles are not user settings in the baseline. The projection attaches the exact readonly `defaultLightThemeProfile` and `defaultDarkThemeProfile` snapshots; it does not resolve profile IDs, select from a registry or copy profile data. The two semantic CSS-variable maps keep the integration profile-shaped, so a future profile setting can change where the projection obtains each snapshot without replacing the presentation contract. `_buildAppearanceProjection` remains store-private.
- Reusable engine profiles are stored in `analysis.engineInventory` and edited through the draft here; `EnginesStore` reads the accepted inventory for selection and owns discovered option metadata and package folders. Copied in-game engines and their runtime state remain outside this store.
- `UserSettingService` coerces every accepted snapshot: `restorePreviousSession` forces `autosaveOnClose`, the default game name is trimmed, and missing `allowTakeback`/`showLiveAnalysisMoves` defaults become `true`/`false`. `SettingsStore` therefore always edits and displays an already-coerced accepted snapshot.

## Creation default snapshots

`gameDefaults` is `Omit<ICreateGameRequest, 'rootPosition'>`, so quick-game defaults use the same request shape and schema as custom creation. Draft creation and discard copy players, assigned-engine option maps, the clock and analysis profile snapshots through `copyGameRequest`. Accepted defaults remain unchanged during edits; failed persistence retains both the accepted snapshot and the full draft. `QuickGameComposable` and `GameCreationModal` initialise from accepted `settings.gameDefaults`, never from an unsaved draft. See the [quick game defaults design](../../../ArchivedPlans/QuickGameDefaultsDesign.md).
