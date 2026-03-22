# SettingsStore

## Purpose
Own the authoritative user settings snapshot, defaults, validation, and persistence.

## Public Interface
```ts
loadSettings(): Promise<ISettingsSnapshot>
getSettings(): ISettingsSnapshot
updateSettings(patch: Partial<ISettingsSnapshot>): void
saveSettings(): Promise<void>
resetSettings(): Promise<void>
```

## Responsibilities
- expose only committed settings from the settings contract
- validate engine inventory and gameplay policy values
- provide defaults when no valid snapshot exists
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
