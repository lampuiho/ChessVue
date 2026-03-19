# StateManagement/UiStateStore.md
# UiStateStore Module (State Management)

## Purpose
Track UI session state and persistence for route and panel state.

## Data Interfaces
- IUiState (from DataInterface/UiState.md)

## Module Functions
- getCurrentGameId(): string | null
- setCurrentGameId(gameId: string): void
- showModal(modalName: string): void
- hideModal(modalName: string): void
- 	ogglePanel(panelName: string): void
- persistState(): void
- loadState(): IUiState
- openTab(gameId: string): void
- closeTab(gameId: string): void

## Calls
- StorageAdapter.getItem
- StorageAdapter.setItem
