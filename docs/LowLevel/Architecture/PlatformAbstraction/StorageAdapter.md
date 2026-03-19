# PlatformAbstraction/StorageAdapter.md
# StorageAdapter Module (Platform Abstraction)

## Purpose
Abstract key/value persistence for settings, games, UI state, and analysis cache.

## Data Interfaces
- StorageEntry<T>
- IUiState (from DataInterface/UiState.md)
- SettingsSchema (from DataInterface/Settings.md)
- IGame (from DataInterface/Game.md)

## Module Functions
- getItem<T>(key: string): Promise<T | null>
- setItem<T>(key: string, value: T): Promise<void>
- emoveItem(key: string): Promise<void>
- clear(): Promise<void>

## Calls
- underlying platform storage APIs (localStorage, IndexedDB, file store)
