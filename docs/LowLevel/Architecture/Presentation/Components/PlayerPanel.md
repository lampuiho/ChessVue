# PlayerPanel

## Purpose
Render player slots, clock state, engine status, and side-specific actions.

## Consumes
- player-slot data
- clock snapshot
- engine availability for assigned engines

## Emits
- `pauseRequested`
- `resumeRequested`
- `resignRequested`
- `drawOffered`
