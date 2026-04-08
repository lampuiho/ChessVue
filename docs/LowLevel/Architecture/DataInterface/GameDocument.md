# Saved Game Payload

## Purpose
Define the canonical persisted saved-game payload used for autosave, internal save/load files, and external import/export.

## Canonical Shape
The baseline does not define a separate persisted `IGameDocument` interface.

The canonical saved-game payload is `IGameWorkspace` from [Game.md](Game.md).

## Included In The Persisted Game
- `schemaVersion`
- game identity and timestamps from `metadata`
- `workspaceKind` and `interactionContext`
- `clockState`, `resultState`, and `resultReason`
- `drawOfferState`
- `whitePlayer` and `blackPlayer`, including captured assigned-engine snapshots when a seat is engine-controlled
- `boardRoot` and the full `moveTree`
- `livePath` and `visiblePath`
- `timeControl` and `clockSnapshot`
- `liveAnalysisOptions.showLiveAnalysisMoves`
- `analysisAssignment`, including the persisted assigned-engine row order for the active game

## Rules
- `IGameWorkspace` is the canonical payload for autosave storage, ChessVue-managed save files, and external import/export files.
- Restore rebuilds the saved game workspace from that payload, then may resume live analysis when available.
- Panel visibility, panel positioning, and other layout concerns are not stored inside the saved game payload.
- Analysis output is runtime state and is not part of the baseline saved-game payload.
- The saved payload must preserve enough state to round-trip result cause, unresolved draw-offer state, captured engine configuration, live-path selection, visible-path selection, and the per-game live-analysis preference without inventing a second persisted sidecar document.
