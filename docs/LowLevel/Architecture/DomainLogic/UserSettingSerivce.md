# UserSettingSerivce

## Purpose
Own the canonical user-settings file rules plus loading, caching, validation, default fallback, and persistence for the committed settings snapshot.

## Public Interface
```ts
getSettingsOrDefault(): Promise<ISettingsSnapshot>
getSettings(): ISettingsSnapshot
saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot>
resetSettings(): Promise<ISettingsSnapshot>
```

## Responsibilities
- keep the canonical settings-file location and pathing rules in one layer-2 service
- lazily read the settings snapshot through `StorageAdapter` and deserialise or migrate it through `SerializationService`
- fall back to the authoritative default snapshot when the stored settings file is missing, corrupt, or no longer valid
- validate accepted settings snapshots before exposing them to layer 3 or writing them back to storage
- cache the accepted settings snapshot so `GamesStore`, `SettingsStore`, and other layer-3 owners can read current settings without sibling-store calls
- persist accepted settings independently from saved games, session state, and UI-layout state

## Dependencies
- `StorageAdapter`
- `SerializationService`

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
- `UserSettingSerivce` is the layer-2 boundary for current-settings reads by other stores. `GamesStore` and other layer-3 owners do not read policy settings from `SettingsStore`.
- `SettingsStore` remains the owner of settings-screen state, pending draft changes, and appearance projection for the UI.
- `getSettingsOrDefault()` is the lazy first-read boundary. Missing or invalid files resolve to the default accepted snapshot without requiring an eager bootstrap phase.
- Validation and defaulting belong here so the accepted snapshot stays consistent whether it was first read from a view setup path, applied from the settings screen, saved explicitly, or reset to defaults.
