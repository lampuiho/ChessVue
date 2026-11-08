# UserSettingService

## Purpose
Own accepted settings loading, caching, validation, default fallback and persistence for the committed settings snapshot.

## Public Interface
```ts
// src/domain/UserSettingService.ts
getSettingsOrDefault(): Promise<ISettingsSnapshot>
getSettings(): ISettingsSnapshot
getLoadWarning(): string
getSystemTheme(): ResolvedThemeMode
saveSettings(snapshot: ISettingsSnapshot): Promise<ISettingsSnapshot>
resetSettings(): Promise<ISettingsSnapshot>
```

## Responsibilities
- lazily read the settings snapshot from `BuildConfig.persistence.settingsPath` through the platform storage boundary
- fall back to the authoritative default snapshot when the stored settings file is missing, corrupt or no longer valid, and record a recovery warning when it existed but could not be accepted
- validate accepted settings snapshots before exposing them to layer 3 or writing them back to storage
- coerce accepted settings so `gameSession.restorePreviousSession = true` always yields an effective `gameSession.autosaveOnClose = true`
- cache the accepted settings snapshot so `GamesStore`, `SavedGamesStore`, `RecentGameStore`, `SettingsStore` and other layer-3 owners can read current settings without sibling-store calls
- persist accepted settings independently from saved games, session state and UI-layout state
- expose the host system theme as an explicit capability without leaking `ISystemThemeAdapter` to layer 3

## Dependencies
- `usePlatformService()` for `IStorageAdapter` and `ISystemThemeAdapter`
- `settingsSnapshotSchema` from the settings contract
- `BuildConfig` for the settings path and `StockfishConfig` for the bundled default engine
- `GameCreationUtility` (`createLocalPlayer`, `createEnginePlayer`) for default seats

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
- `SettingsStore` remains the owner of settings-screen state, pending draft changes and the appearance projection for the UI. It surfaces `getLoadWarning()` as its recovery warning.
- `getSettingsOrDefault()` is the lazy first-read boundary and returns the cached snapshot on later calls. A `notFound` read resolves silently to defaults. Any other read, JSON or schema failure is logged, sets the load warning ("Settings could not be read. Default preferences are in use; open Settings to review and save them.") and resolves to defaults. No eager bootstrap phase is required.
- `getSettings()` is the synchronous read. Before the first load it caches and returns the defaults.
- `saveSettings(...)` parses and coerces the snapshot, writes it with overwrite, then caches it. `resetSettings()` writes and caches the defaults. A failed write leaves the previous accepted snapshot cached.
- The service reads and writes the settings file through `IStorageAdapter` and `settingsSnapshotSchema` itself, rather than through `SerializationService`. The schema requires `schemaVersion: 1`, so unsupported versions are rejected as invalid settings and fall back to defaults.
- `getSystemTheme()` exposes an explicit platform capability. Nothing in the application currently calls it: CSS selects the active palette in system mode.
- Validation, coercion and defaulting belong here so the accepted snapshot stays consistent whether it was first read from a view setup path, applied from the settings screen, saved explicitly or reset to defaults. Coercion also trims the default game name and fills an absent `allowTakeback` (`true`) or `showLiveAnalysisMoves` (`false`).
- Schema parsing is the accepted-settings ownership boundary. The resulting snapshot is cached and returned directly without defensive cloning; `SettingsStore` provides draft isolation through copy-on-write when editing begins. **Why:** parsing already transfers validated ownership to the service, so cloning on every read would replace stable accepted-state identity without protecting against a mutation path; the actual divergence occurs only when a draft edit starts.
- Build config owns the concrete settings-file path. `UserSettingService` does not decide that path; it only uses it. In the browser that path is a virtual file in the managed file index.

## Default Settings
Defaults are parsed through the same schema as every accepted snapshot, so a draft copy of them compares equal to the stored form.

| Area | Default |
| --- | --- |
| `gameSession` | restore previous session on; save root `saves`; autosave after every move; autosave on close on; auto-pause on Menu on |
| `gameDefaults` | name `New Game`; untimed; White a local player; Black the bundled Stockfish engine (`EngineClientType.UciWorker`, `StockfishConfig.entryPath`); no analysis engines; takebacks allowed; live-analysis moves shown; random colours on |
| `gameplay` | return to the live node when leaving an analysis branch; explicit promotion selection |
| `analysis` | resume live analysis after restore; engine inventory containing the bundled Stockfish profile (id `stockfish`) |
| `appearance` | system theme; `classic` board and piece themes; 100% scale; White orientation; coordinates and last-move highlight shown |

`gameDefaults` reuses the game-creation request schema without `rootPosition`, so clock, seat colour and unique analysis-engine names are validated by `getGameCreationError(...)` before persistence. Engine configurations are stored as snapshots with runtime fields removed; inventory membership is not required. No compatibility conversion is provided for earlier unpublished settings shapes.
