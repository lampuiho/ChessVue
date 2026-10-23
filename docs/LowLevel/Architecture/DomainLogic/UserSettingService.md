# UserSettingService

## Purpose
Own accepted settings loading, caching, validation, default fallback, and persistence for the committed settings snapshot.

## Public Interface
```ts
getSettingsOrDefault(): Promise<ISettingsSnapshot>
getSettings(): ISettingsSnapshot
getSystemTheme(): ResolvedThemeMode
saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot>
resetSettings(): Promise<ISettingsSnapshot>
```

## Responsibilities
- lazily read the settings snapshot through the platform storage boundary using the build-config settings path
- expose the current system theme to higher layer settings flows without leaking `SystemThemeAdapter` to layer 3
- fall back to the authoritative default snapshot when the stored settings file is missing, corrupt, or no longer valid
- validate accepted settings snapshots before exposing them to layer 3 or writing them back to storage
- coerce accepted settings so `gameSession.restorePreviousSession = true` always yields an effective `gameSession.autosaveOnClose = true`
- cache the accepted settings snapshot so `GamesStore`, `SettingsStore`, and other layer-3 owners can read current settings without sibling-store calls
- persist accepted settings independently from saved games, session state, and UI-layout state

## Dependencies
- `PlatformService`
- `StorageAdapter`
- `SystemThemeAdapter`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-02`
- `SCN-SESSION-03`
- `SCN-NAV-01`
- `SCN-SAVE-01`
- `SCN-HIST-02`
- `SCN-HIST-03`
- `SCN-HIST-04`
- `SCN-TIME-05`
- `SCN-SETTINGS-01`
- `SCN-SETTINGS-02`
- `SCN-ENGINE-01`
- `SCN-ENGINE-02`

## Notes
- `UserSettingService` is the layer-2 boundary for current-settings reads by other stores. `GamesStore` and other layer-3 owners do not read policy settings from `SettingsStore`.
- `SettingsStore` remains the owner of settings-screen state, pending draft changes, and appearance projection for the UI.
- `getSettingsOrDefault()` is the lazy first-read boundary. Missing or invalid files resolve to the default accepted snapshot without requiring an eager bootstrap phase.
- `getSystemTheme()` exposes an explicit platform capability. App styling does not call it: CSS selects the active palette in system mode.
- Validation, coercion, and defaulting belong here so the accepted snapshot stays consistent whether it was first read from a view setup path, applied from the settings screen, saved explicitly, or reset to defaults.
- Schema parsing is the accepted-settings ownership boundary. The resulting snapshot is cached and returned directly without defensive cloning; `SettingsStore` provides draft isolation through copy-on-write when editing begins. **Why:** parsing already transfers validated ownership to the service, so cloning on every read would replace stable accepted-state identity without protecting against a mutation path; the actual divergence occurs only when a draft edit starts.
- Build config owns the concrete settings-file path. `UserSettingService` does not decide that path; it only uses it.
- Future non-desktop implementations may persist accepted settings elsewhere without changing the shared path-based adapter contract.
