# UiStateStore Module (State Management)

## Purpose
Track UI state (active game ID, selected panels, modal visibility, route preferences).

## Interfaces
- `IUiState`
- `UiStatePersistence`

## Module Functions
- `getCurrentGameId(): string | null`
- `setCurrentGameId(gameId: string): void`
- `showModal(modalName: string): void`
- `hideModal(modalName: string): void`
- `togglePanel(panelName: string): void`
- `persistState(): void`
- `loadState(): IUiState`

## Called By
- `GameView.mounted`
- `MenuBarComponent.onOpenRecent`
- `Router.beforeRouteUpdate`

## Calls
- `StorageAdapter.getItem`
- `StorageAdapter.setItem`
