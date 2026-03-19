# PlatformAbstraction/FileIoAdapter.md
# FileIOAdapter Module (Platform Abstraction)

## Purpose
Provide file import/export abstractions for game data using browser and desktop file APIs.

## Data Interfaces
- IGame (from DataInterface/Game.md)
- GameFileMeta

## Module Functions
- saveGameToFile(game: IGame, filename: string): Promise<void>
- loadGameFromFile(file: File): Promise<IGame>
- listRecentFiles(): Promise<GameFileMeta[]>

## Calls
- Platform file APIs
- SerializationService.deserializeGameFromJSON
- SerializationService.serializeGameToJSON
