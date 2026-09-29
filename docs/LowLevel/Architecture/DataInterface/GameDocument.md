# Saved Game Payload

## Purpose
Define the canonical persisted saved-game payload used for autosave, internal save/load files, and external import/export.

## Canonical Shape
The baseline does not define a separate persisted `IGameDocument` interface.

The canonical saved-game payload is `IGame` from [Game.md](Game.md).

## Included In The Persisted Game
- `schemaVersion`
- game identity and timestamps from `metadata`
- `gameState`, `resultState`, and `resultReason`
- `drawOfferState`
- `whitePlayer` and `blackPlayer`, including copied in-game engine payloads when a seat is engine-controlled
- `rootPosition` and the full `moveTree`
- `livePath` and `renderedPath`
- `timeControl` and `clockSnapshot`
- `gameplayOptions`, including `allowTakeback` and `showLiveAnalysisMoves`
- `analysis`, including the ordered persisted analysis seat rows for the active game

## Rules
- `IGame` is the canonical payload for autosave storage, ChessVue-managed save files, and external import/export files.
- `gameplayOptions`, including `allowTakeback` and `showLiveAnalysisMoves`, travel with the saved game. **Why:** these values change how that game's history and live analysis behave; restoring them from current global UI choices would silently change the rules of an existing game.
- Restore rebuilds the saved game workspace from that payload, then may resume live analysis when available.
- Panel visibility, panel positioning, and other layout concerns are not stored inside the saved game payload.
- Runtime-only `$` members are never stored inside the canonical saved-game payload.
- The saved payload must preserve enough state to round-trip result cause, unresolved draw-offer state, captured engine configuration, live-path selection, highlight-path selection, persisted analysis seats, and the per-game live-analysis preference without inventing a second persisted sidecar document.
