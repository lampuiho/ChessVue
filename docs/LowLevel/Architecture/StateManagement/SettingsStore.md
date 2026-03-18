# SettingsStore Module (State Management)

## Purpose
Persist and apply user preferences for UI, board style, time presets, and engine defaults.

## Interfaces
- `ISettingsStore`
- `SettingsSchema`

## Module Functions
- `loadSettings(): SettingsSchema`
- `saveSettings(settings: SettingsSchema): void`
- `getSetting<T extends keyof SettingsSchema>(key: T): SettingsSchema[T]`
- `updateSetting<T extends keyof SettingsSchema>(key: T, value: SettingsSchema[T]): void`
- `resetSettings(): SettingsSchema`

## Called By
- `SettingsView.init`
- `App.vue.onBeforeMount`
- `GameView.applyTheme`

## Calls
- `StorageAdapter.getItem`
- `StorageAdapter.setItem`
- `UiStateStore.persistState` (for theme/UI toggles)
