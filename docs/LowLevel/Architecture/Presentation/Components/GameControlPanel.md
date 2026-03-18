# GameControlPanel Component (Presentation)

## Purpose
Buttons for resign, draw offer, takeback, pause, and analysis mode.

## Interfaces
- `GameControlPanelProps`

## Component Methods
- `onResign(): void`
- `onOfferDraw(): void`
- `onTakeBack(): void`
- `onPause(): void`
- `onEnterAnalysisMode(): void`

## Called By
- `GameView`

## Calls
- `GamesStore.takeBack`
- `UiStateStore.showModal`
- `GamesStore.makeMove`
