# UI State Interfaces

## Purpose
Define app UI state and modal/panel status persisted between sessions.

## Interfaces
- `IUiState`
- `ModalState`
- `PanelState`

## Data Structures
- `interface IUiState {
  currentGameId: string | null
  activeRoute: string
  openModals: Record<string, boolean>
  visiblePanels: Record<string, boolean>
  recentGameIds: string[]
  activeTabIds: string[]
}
