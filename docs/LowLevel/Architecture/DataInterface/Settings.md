# Settings Interfaces

## Purpose
Define persisted user settings and editor-friendly preference models.

## Interfaces
- `BoardTheme`
- `PieceTheme`
- `SettingsSchema`

## Data Structures
- `interface SettingsSchema {
  boardTheme: string
  pieceTheme: string
  orientation: "white" | "black"
  timePreset: ITimeControlConfig
  engineDefaults: Partial<IEngineConfig>
  showCoordinates: boolean
  highlightLastMove: boolean
  soundEnabled: boolean
  darkMode: boolean
}
