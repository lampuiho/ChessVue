# Saved Game Payload

## Purpose
Define the canonical persisted saved-game payload used for autosave and manual import/export.

## Canonical Shape
The baseline does not define a separate persisted `IGameDocument` interface.

The canonical saved-game payload is `IGameWorkspace` from [Game.md](Game.md).

## Included In The Persisted Game
- game identity and timestamps from `metadata`
- workspace kind and interaction context
- result state
- player slots and engine assignment
- board root and move tree
- live and visible node identity
- time control and clock snapshot

## Rules
- `IGameWorkspace` is the canonical payload for both autosave storage and manual file export.
- Restore rebuilds the saved game workspace from that payload, then may resume live analysis when available.
- Panel visibility, panel positioning, and other layout concerns are not stored inside the saved game payload.
- Analysis output is runtime state and is not part of the baseline saved-game payload.
