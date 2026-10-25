# SettingsStore

## Purpose
Own user-settings screen state, editable user-setting drafts, and appearance projection for the committed settings UI.

## Public Interface
```ts
settings: DeepReadonly<ISettingsSnapshot> | undefined
draftSettings: ISettingsSnapshot | undefined
appearanceProjection: IAppearanceProjection | undefined
hasPendingChanges: boolean
loadSettings(): Promise<void>
updateSettings(patch: Partial<ISettingsSnapshot>): void
applySettings(): Promise<void>
discardPendingSettings(): void
saveSettings(): Promise<void>
resetSettings(): Promise<void>
```

## Responsibilities
- lazily load and expose the accepted settings snapshot as readonly state for `SettingsView`
- keep a draft settings snapshot separate from the last accepted snapshot so apply/save/cancel flows are deterministic
- commit accepted settings changes through `UserSettingService` instead of owning raw settings-file access directly
- expose the accepted `appearance.themeMode` policy for CSS to apply
- build the presentation-safe appearance projection, including the light and dark profile snapshots
- keep the appearance projection reactive when accepted settings change

## Dependencies
- `UserSettingService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SETTINGS-01`
- `SCN-SETTINGS-02`

## Notes
- `SettingsStore` consumes `UserSettingService` for accepted settings reads and writes; it does not resolve `IPlatformService`, `StorageAdapter`, or `SystemThemeAdapter` directly.
- `loadSettings()` is the lazy single-flight accepted-settings boundary. It hydrates from `UserSettingService.getSettingsOrDefault()`, exposes the accepted snapshot through the readonly `settings` projection, and creates an independent reactive `draftSettings` value for mutable settings branches.
- `appearanceProjection` is computed from accepted settings and exposes both palettes without resolving the OS theme. Draft appearance changes do not affect app chrome until apply or save succeeds.
- `applySettings()` persists the current draft through `UserSettingService.saveSettings(...)`, then re-syncs both accepted and draft state from the returned accepted snapshot so Apply and Save share the same persistence semantics.
- Accepted settings and the draft do not share mutable settings branches because the draft may temporarily be invalid. Loading, successful persistence, reset, and discard create a fresh settings draft.
- `draftSettings` supports direct nested form mutation; `updateSettings(...)` remains available for programmatic patches. `hasPendingChanges` is computed reactively from the current accepted and draft values.
- A failed validation or write leaves accepted settings unchanged and retains the edited draft. The accepted-to-draft copy is the intentional ownership boundary; ordinary draft edits do not clone state.
- CSS `color-scheme` and `light-dark()` select the active palette. The store neither queries nor subscribes to system-theme changes.
- Theme profiles are not user settings in the baseline. The appearance projection attaches the exact readonly light and dark configuration snapshots; it does not resolve profile IDs, select from a registry, or copy profile data.
- Reusable engine profiles and their discovered option metadata are owned by `EnginesStore`; copied in-game engines and their runtime state remain outside this store.
- The `restorePreviousSession => autosaveOnClose` rule is enforced by `UserSettingService`, so `SettingsStore` always edits and displays an already-coerced accepted snapshot.
- The two semantic CSS-variable maps in `IAppearanceProjection` keep the integration profile-shaped. A future profile setting can change where the projection obtains each snapshot without replacing the presentation contract.
- `_buildAppearanceProjection` remains store-private. CSS owns effective light/dark selection, so no JavaScript theme resolver is needed.

## Creation default snapshots

`gameDefaults` derives from the creation request without `rootPosition`. Draft creation and discard copy players, assigned engine option maps, the clock and analysis profile snapshots through the creation schema. Accepted defaults remain unchanged during edits; failed persistence retains both the accepted snapshot and full draft.
