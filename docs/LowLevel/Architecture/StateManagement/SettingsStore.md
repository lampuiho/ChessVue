# SettingsStore

## Purpose
Own settings-screen state, editable settings drafts, and appearance projection for the committed settings UI.

## Public Interface
```ts
getSettings(): Promise<ISettingsSnapshot>
getDraftSettings(): ISettingsSnapshot
getAppearanceProjection(): Promise<IAppearanceProjection>
updateSettings(patch: Partial<ISettingsSnapshot>): void
hasPendingChanges(): boolean
applySettings(): void
discardPendingSettings(): void
saveSettings(): Promise<void>
resetSettings(): Promise<void>
```

## Responsibilities
- lazily read and expose the accepted settings snapshot for `SettingsView`
- keep a draft settings snapshot separate from the last accepted snapshot so apply/save/cancel flows are deterministic
- own engine-inventory draft edits as part of the same pending settings snapshot used by `Cancel`, `Apply`, and `Save`
- commit accepted settings changes through `UserSettingSerivce` instead of owning raw settings-file access directly
- resolve the effective app theme from `appearance.themeMode` and the active system theme
- build the presentation-safe appearance projection, including the semantic CSS-variable map
- keep the appearance projection reactive when accepted settings or system-theme events change

## Dependencies
- `UserSettingSerivce`
- `PlatformEventService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SETTINGS-01`
- `SCN-SETTINGS-02`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`

## Notes
- `SettingsStore` consumes `UserSettingSerivce` for accepted settings reads and writes plus `PlatformEventService` for theme-change reactions; it does not resolve `IPlatformService`, `StorageAdapter`, or `SystemThemeAdapter` directly.
- `getSettings()` is the lazy accepted-settings boundary. On first read it hydrates from `UserSettingSerivce.getSettingsOrDefault()`, mirrors that snapshot into the editable draft, and caches the accepted state for later callers.
- `getAppearanceProjection()` may trigger that same first-read path when needed by a view setup body, then resolves and caches the current `IAppearanceProjection` by calling `UserSettingSerivce.getSystemTheme()` when `appearance.themeMode = ThemeMode.System`.
- Accepted engine-inventory changes update reusable engine profiles only. They do not directly mutate already assigned engine participants or running engine sessions.
- The semantic CSS-variable map in `IAppearanceProjection` is intentionally configuration-reactive so a future user-created theme system can extend the same contract rather than replacing it.
- Flow docs continue to show `SettingsStore._resolveThemeMode` and `SettingsStore._buildAppearanceProjection` as the visible owner-private boundaries. If those functions share implementation, that implementation is documented under `AppearanceProjectionUtility` in [UtilityIndex.md](../UtilityIndex.md).
