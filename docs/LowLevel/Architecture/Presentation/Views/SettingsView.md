# SettingsView Component (Presentation)

## Purpose
Render settings UI and update settings state.

## Interfaces
- `SettingsViewProps`

## Component Methods
- `setupSettingsForm(): void`
- `onSave(): void`
- `onReset(): void`

## Called By
- `Router` route for /settings

## Calls
- `SettingsStore.loadSettings`
- `SettingsStore.saveSettings`
- `EnginesStore.listEngines`
- `UiStateStore.persistState`
