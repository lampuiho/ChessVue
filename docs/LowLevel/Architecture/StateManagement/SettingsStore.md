# SettingsStore

## Purpose
Own the authoritative user settings snapshot, defaults, validation, and persistence.

## Public Interface
```ts
loadSettings(): Promise<ISettingsSnapshot>
getSettings(): ISettingsSnapshot
getDraftSettings(): ISettingsSnapshot
getAppearanceProjection(): IAppearanceProjection
updateSettings(patch: Partial<ISettingsSnapshot>): void
hasPendingChanges(): boolean
applySettings(): void
discardPendingSettings(): void
saveSettings(): Promise<void>
resetSettings(): Promise<void>
```

## Responsibilities
- expose only committed settings from the settings contract
- validate engine inventory and gameplay policy values
- provide defaults when no valid snapshot exists
- keep a draft settings snapshot separate from the last accepted snapshot so apply/save/cancel flows are deterministic
- own engine-inventory draft edits as part of the same pending settings snapshot used by `Cancel`, `Apply`, and `Save`
- resolve the effective app theme from `appearance.themeMode` and the active system theme
- build the presentation-safe appearance projection, including the semantic CSS-variable map
- keep the appearance projection reactive when accepted settings or system-theme events change
- persist settings independently from session and game data

## Dependencies
- `PlatformServices`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SETTINGS-01`
- `SCN-SETTINGS-02`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`

## Notes
- `SettingsStore` resolves `StorageAdapter` through `usePlatformServicesStore()`.
- `SettingsStore` also resolves `SystemThemeAdapter` through `usePlatformServicesStore()` so `themeMode = system` can be mapped to a current built-in theme.
- `loadSettings()` must produce both the persisted settings snapshot and the initial `IAppearanceProjection` before the root app-shell surface binds to shared app chrome.
- Accepted engine-inventory changes update reusable engine profiles only. They do not directly mutate already assigned engine participants or running engine sessions.
- The semantic CSS-variable map in `IAppearanceProjection` is intentionally configuration-reactive so a future user-created theme system can extend the same contract rather than replacing it.
