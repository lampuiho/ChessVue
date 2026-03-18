# StorageAdapter Module (Platform Abstraction)

## Purpose
Abstract key/value persistence for settings, games, and UI state.

## Interfaces
- `IStorageAdapter`
- `StorageEntry<T>`

## Module Functions
- `getItem<T>(key: string): Promise<T | null>`
- `setItem<T>(key: string, value: T): Promise<void>`
- `removeItem(key: string): Promise<void>`
- `clear(): Promise<void>`

## Called By
- `SettingsStore.loadSettings`
- `SettingsStore.saveSettings`
- `GamesStore.loadGames`
- `GamesStore.saveGame`
- `UiStateStore.persistState`

## Calls
- Underlying platform storage implementation (e.g. `localStorage` or file store)
