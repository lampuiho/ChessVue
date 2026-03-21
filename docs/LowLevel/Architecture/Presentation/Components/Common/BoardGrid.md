# BoardGrid

## Purpose
Provide a reusable board grid surface that arranges square render components by orientation.

## Consumes
- ordered square view models
- board orientation
- square content slot

## Emits
- none directly

## Notes
- `Chessboard` uses `BoardGrid` with `BoardSquare` children so board layout markup stays in the common layer.
