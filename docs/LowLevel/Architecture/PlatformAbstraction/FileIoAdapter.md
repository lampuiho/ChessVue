# FileIOAdapter Module (Platform Abstraction)

## Purpose
Abstract game file load/save across browsers and desktop platforms.

## Interfaces
- `IFileIoAdapter`
- `GameFileMeta`

## Module Functions
- `saveGameToFile(game: IGame, filename: string): Promise<void>`
- `loadGameFromFile(file: File): Promise<IGame>`
- `listRecentFiles(): Promise<GameFileMeta[]>`

## Called By
- `GamesStore.importGameFromFile`
- `GamesStore.exportGameToFile`
- `GameView.onLoadGameClicked`

## Calls
- Platform file APIs (`File`, `FileReader`, `fetch`, native file dialogs)
- `Serialization.deserializeGameFromJSON`
- `Serialization.serializeGameToJSON`
