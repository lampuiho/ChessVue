# StateManagement/UiStateStore.md
# UiStateStore Module (State Management)

## Purpose
Track UI session state and persistence.

## Data Interfaces
- IUiState (from DataInterface/UiState.md)

## Module Functions
- getCurrentGameId(): string | null
- setCurrentGameId(gameId: string): void
- showModal(modalName: string): void
- hideModal(modalName: string): void
- togglePanel(panelName: string): void
- persistState(): Promise<void>
- loadState(): Promise<IUiState>
- openTab(gameId: string): void
- closeTab(gameId: string): void

## Private Helpers
- validateUiState(state: IUiState): IUiState

## Calls
- StorageAdapter.getItem
- StorageAdapter.setItem
