# ClockDisplay

## Purpose
Provide a reusable clock readout for timed and untimed game states.

## Consumes
- formatted time value
- running, paused, expired, or inactive state
- active-side emphasis

## Emits
- none directly

## Notes
- `PlayerPanel` uses `ClockDisplay` so clock markup stays out of feature components.
