# FileIoAdapter

## Purpose
Handle user-driven desktop import/export and path-based reopen of the canonical saved game payload.

## Public Interface
```ts
interface ILoadedGame {
  workspace: IGameWorkspace
  filePath: string
}

saveGame(workspace: IGameWorkspace): Promise<string>
loadGame(): Promise<ILoadedGame>
loadGameFromPath(filePath: string): Promise<IGameWorkspace>
```

## Responsibilities
- open desktop file dialogs for save/load flows
- reopen a known saved game file without prompting when recent-game history points to a manual file path
- write and read the canonical JSON game payload only
- surface actionable errors for cancel, permission, and invalid-file failures

## Dependencies
- desktop file APIs
- `SerializationService` for serialise/parse and migration
- shared platform failure contract from `DataInterface/PlatformError`

## Failure Semantics
- `saveGame` rejects with `IPlatformError` of kind `cancelled` when the user dismisses save without choosing a destination.
- `saveGame` rejects with `permissionDenied` when the selected destination cannot be written.
- `loadGame` rejects with `cancelled` when the user dismisses load without choosing a file.
- `loadGame` rejects with `invalidDocument` when the selected file is unsupported, corrupt, incomplete, or otherwise cannot produce a usable canonical saved game payload after parse and migration.
- `loadGame` and `loadGameFromPath` may reject with `notFound` or `permissionDenied` when the host cannot reopen the selected file path.

## Rewrite-Phase Mock Note
- The first implementation pretends to run on `NW.js` but uses canned documents and canned error modes instead of real file dialogs.

## Notes
- Duplicate imported IDs are handled after load, before insertion into stores.
- Invalid imports are rejected atomically; the baseline file-flow contract does not include partial recovery.
- Broader external formats and batch workflows are not baseline.
- `saveGame` returns the final written file path so recent-game metadata can point to the actual manual-save target.
