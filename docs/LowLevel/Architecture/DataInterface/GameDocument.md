# Saved Game Payload

## Purpose
Define the canonical persisted saved-game payload used for autosave, internal save/load files, and external import/export, and the save-target request that chooses where it is written.

## Canonical Shape
The baseline does not define a separate persisted `IGameDocument` interface.

The canonical saved-game payload is `IGame` from [Game.md](Game.md), validated by `gameSchema`.

## Included In The Persisted Game
- `schemaVersion`
- game identity and timestamps from `metadata`
- `gameState`, `resultState`, and `resultReason`
- `drawOfferState`
- `whitePlayer` and `blackPlayer`, including copied in-game engine payloads when a seat is engine-controlled
- `rootPosition` and the full `moveTree`, including per-node clock snapshots and any `recordedAnalysis`
- `livePath` and `renderedPath`
- `timeControl` and `clockSnapshot`
- `gameplayOptions`, including `allowTakeback` and `showLiveAnalysisMoves`
- `analysis`, including the ordered persisted analysis seat rows for the active game

## Rules
- `IGame` is the canonical payload for autosave storage, ChessVue-managed save files, and external import/export files.
- `gameplayOptions`, including `allowTakeback` and `showLiveAnalysisMoves`, travel with the saved game. **Why:** these values change how that game's history and live analysis behave; restoring them from current global UI choices would silently change the rules of an existing game.
- `SerializationService.serialiseGame(...)` re-parses the in-memory game through `gameSchema` before `JSON.stringify`, and `deserialiseGame(...)` parses the JSON through the same schema. Both then check that every `mainlineChildIndex` references an existing child and that `renderedPath` and any `livePath` resolve to nodes. Any failure raises `SerializationError`.
- Restore rebuilds the saved game workspace from that payload, then may resume live analysis when available.
- Panel visibility, panel positioning, and other layout concerns are not stored inside the saved game payload.
- Runtime-only `$` members are never stored inside the canonical saved-game payload. Because no schema declares `$`, the write-side parse drops it, together with premove queues, pause owners, pending turns, engine runtimes, and result-notification state.
- The saved payload must preserve enough state to round-trip result cause, unresolved draw-offer state, captured engine configuration, live-path selection, highlight-path selection, persisted analysis seats, and the per-game live-analysis preference without inventing a second persisted sidecar document.
- Managed save folders are named from `metadata.id` when a game is saved. On load, `SavedGamesStore.loadGame(...)` and `loadRecentGame(...)` set `metadata.id` to the selected folder's game ID, and an external import replaces it with a fresh UUID so imported metadata is never reused as a managed folder name. Session restore keeps the document's ID; `GamesStore` repairs any duplicate when inserting it.

## Save Targets
`contracts/state/ISaveGameOptions.ts` defines the request passed to `SavedGamesStore.saveGame(game, options)`.

```ts
const enum SaveGameTargetKind {
  Autosave = "autosave",
  ManagedSave = "managedSave",
  ExternalFile = "externalFile"
}

interface ISaveGameOptions {
  targetKind: SaveGameTargetKind
  saveName?: string
  filePath?: string
  overwrite?: boolean
}
```

- `Autosave` writes the game's autosave file under the managed save root and carries neither `saveName` nor `filePath`. Move-count autosave and close-trigger autosave use it.
- `ManagedSave` writes a named save in the game's managed folder and requires `saveName` without `filePath`.
- `ExternalFile` writes to the user-selected `filePath` used by export.
- `saveGameTargetKinds` feeds `saveGameTargetKindSchema`. `saveGameOptionsSchema` encodes the pairings above and requires non-empty `saveName` and `filePath` values when present. `SavedGamesStore.saveGame(...)` relies on that pairing without re-parsing the options.
- An omitted `overwrite` means the target may be overwritten; `overwrite: false` asks the storage adapter to reject an existing file with `alreadyExists`.
- Managed folder and file paths are resolved by [SavedGameIndexService](../DomainLogic/SavedGameIndexService.md).
