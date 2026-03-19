# Presentation/Views/Settings.md
# SettingsView Component (Presentation)

## Purpose
Render app settings and dispatch updates to settings state.

## Data Interfaces
- SettingsSchema (from DataInterface/Settings.md)

## Component Methods
- setupSettingsForm(): void
- onSave(): void
- onReset(): void

## Calls
- SettingsStore.loadSettings
- SettingsStore.saveSettings
- EnginesStore.listEngines
- UiStateStore.persistState
