import {
  PlatformErrorKind,
  gameSchema,
  settingsSnapshotSchema,
  gameSessionSnapshotSchema,
  uiLayoutStateSchema,
  type IGame,
  type IGameSessionSnapshot,
  type IMoveNode,
  type IMoveTree,
  type IPlatformError,
  type ISettingsSnapshot,
  type IUiLayoutState,
  type MovePath,
} from '@/contracts';
import type { IFileSystemEntry, IWriteTextFileOptions } from '@/contracts/platform';
import { usePlatformService } from '@/platform';

import { SerializationError } from '../contracts/errors/SerializationError';

function _parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SerializationError('Invalid JSON payload.', error);
  }
}
function _parseWithSchema<T>(artefactName: string, parse: (input: unknown) => T, input: unknown): T {
  try {
    return parse(input);
  } catch (error) {
    throw new SerializationError(`${artefactName} payload is invalid.`, error);
  }
}
function _requireSchemaVersionOne(input: unknown, artefactName: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new SerializationError(`${artefactName} payload must be an object.`, input);
  const schemaVersion = (input as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== 1) throw new SerializationError(`${artefactName} schema version is unsupported.`, schemaVersion);
  return input as Record<string, unknown>;
}
function _validateMoveNode(node: IMoveNode): void {
  if (node.mainlineChildIndex != null && (node.mainlineChildIndex < 0 || node.mainlineChildIndex >= node.children.length)) {
    throw new SerializationError('Move tree mainline child index must reference an existing child.', node.mainlineChildIndex);
  }
  for (const child of node.children) _validateMoveNode(child);
}
function _getNodeAtPath(tree: IMoveTree, path: MovePath, selectorName: string): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) {
    const childNode = currentNode.children[childIndex];
    if (!childNode) throw new SerializationError(`${selectorName} must reference an existing move-tree node.`, path);
    currentNode = childNode;
  }
  return currentNode;
}
function _validateMoveTree(tree: IMoveTree): void {
  _validateMoveNode(tree.root);
}
function _validateGame(game: IGame): void {
  _validateMoveTree(game.moveTree);
  _getNodeAtPath(game.moveTree, game.renderedPath, 'Saved game renderedPath');
  if (game.livePath) _getNodeAtPath(game.moveTree, game.livePath, 'Saved game livePath');
}
function _validateGameSession(snapshot: IGameSessionSnapshot): void {
  if (snapshot.activeGameId != null && !snapshot.openGameIds.includes(snapshot.activeGameId)) {
    throw new SerializationError('Active game id must be included in the open game id list.');
  }
}
function _parseSettingsSnapshot(input: unknown): ISettingsSnapshot {
  _requireSchemaVersionOne(input, 'Settings');
  return _parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), input);
}
function _parseGameSessionSnapshot(input: unknown): IGameSessionSnapshot {
  _requireSchemaVersionOne(input, 'Game session');
  const snapshot = _parseWithSchema<IGameSessionSnapshot>('Game session', (value) => gameSessionSnapshotSchema.parse(value) as IGameSessionSnapshot, input);
  _validateGameSession(snapshot);
  return snapshot;
}
function _parseUiLayoutState(input: unknown): IUiLayoutState {
  _requireSchemaVersionOne(input, 'UI layout state');
  return _parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), input);
}
function _parseGame(input: unknown): IGame {
  _requireSchemaVersionOne(input, 'Saved game');
  const game = _parseWithSchema('Saved game', (value) => gameSchema.parse(value), input);
  _validateGame(game);
  return game;
}
function _isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}
async function _writeDocument(path: string, raw: string, options: IWriteTextFileOptions): Promise<void> {
  await usePlatformService().getStorageAdapter().writeTextFile(path, raw, options);
}

export const SerializationService = {
  async readSettingsDocument(path: string): Promise<ISettingsSnapshot> {
    return this.deserialiseSettings(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeSettingsDocument(path: string, snapshot: ISettingsSnapshot): Promise<void> {
    await _writeDocument(path, this.serialiseSettings(snapshot), { overwrite: true });
  },
  async readGameSessionDocument(path: string): Promise<IGameSessionSnapshot> {
    return this.deserialiseGameSession(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeGameSessionDocument(path: string, snapshot: IGameSessionSnapshot): Promise<void> {
    await _writeDocument(path, this.serialiseGameSession(snapshot), { overwrite: true });
  },
  async readUiLayoutDocument(path: string): Promise<IUiLayoutState> {
    return this.deserialiseUiLayoutState(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeUiLayoutDocument(path: string, state: IUiLayoutState): Promise<void> {
    await _writeDocument(path, this.serialiseUiLayoutState(state), { overwrite: true });
  },
  async readGameDocument(filePath: string): Promise<IGame> {
    return this.deserialiseGame(await usePlatformService().getStorageAdapter().readTextFile(filePath));
  },
  async writeGameDocument(filePath: string, game: IGame, overwrite: boolean = false): Promise<void> {
    await _writeDocument(filePath, this.serialiseGame(game), { overwrite, ensureParentDirectory: true });
  },
  async deleteDocument(filePath: string): Promise<void> {
    await usePlatformService().getStorageAdapter().deleteFile(filePath);
  },
  async listManagedSaveEntries(rootPath: string): Promise<ReadonlyMap<string, IFileSystemEntry[]>> {
    const storageAdapter = usePlatformService().getStorageAdapter();
    try {
      const entriesByDirectory = new Map<string, IFileSystemEntry[]>();
      const rootEntries = await storageAdapter.listDirectory(rootPath);
      entriesByDirectory.set(rootPath, rootEntries);
      for (const entry of rootEntries) {
        if (!entry.isDirectory) continue;
        entriesByDirectory.set(entry.path, await storageAdapter.listDirectory(entry.path));
      }
      return entriesByDirectory;
    } catch (error) {
      if (_isPlatformError(error) && error.kind === PlatformErrorKind.NotFound) return new Map();
      throw error;
    }
  },
  async selectImportFile(startDirectory?: string): Promise<string> {
    return usePlatformService().getStorageAdapter().showOpenDialog(startDirectory);
  },
  async selectExportFile(suggestedPath?: string): Promise<string> {
    return usePlatformService().getStorageAdapter().showSaveDialog(suggestedPath);
  },
  serialiseSettings(snapshot: ISettingsSnapshot): string {
    const persistedSnapshot = _parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), snapshot);
    return JSON.stringify(persistedSnapshot, null, 2);
  },
  deserialiseSettings(raw: string): ISettingsSnapshot {
    return _parseSettingsSnapshot(_parseJson(raw));
  },
  serialiseGameSession(snapshot: IGameSessionSnapshot): string {
    _validateGameSession(snapshot);
    const persistedSnapshot = _parseWithSchema('Game session', (value) => gameSessionSnapshotSchema.parse(value), snapshot);
    return JSON.stringify(persistedSnapshot, null, 2);
  },
  deserialiseGameSession(raw: string): IGameSessionSnapshot {
    return _parseGameSessionSnapshot(_parseJson(raw));
  },
  serialiseUiLayoutState(state: IUiLayoutState): string {
    const persistedState = _parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), state);
    return JSON.stringify(persistedState, null, 2);
  },
  deserialiseUiLayoutState(raw: string): IUiLayoutState {
    return _parseUiLayoutState(_parseJson(raw));
  },
  serialiseGame(game: IGame): string {
    const persistedGame = _parseWithSchema('Saved game', (value) => gameSchema.parse(value), game);
    _validateGame(persistedGame);
    return JSON.stringify(persistedGame, null, 2);
  },
  deserialiseGame(raw: string): IGame {
    return _parseGame(_parseJson(raw));
  },
};
