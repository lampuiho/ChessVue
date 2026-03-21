# SquareSurface

## Purpose
Provide a reusable square cell renderer for board-like layouts.

## Consumes
- square identity
- light or dark tone
- selected, highlighted, target, check, and last-move state
- square content slot

## Emits
- `selected`
- `dropped`

## Notes
- `BoardSquare` adapts square state into `SquareSurface`.
- `SquareSurface` owns the actual square HTML so board cell markup stays inside the common layer.
