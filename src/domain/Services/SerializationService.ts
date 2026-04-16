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
} from '../../contracts';
import { usePlatformService, type IFileSystemEntry } from '@/platform';

import { SerializationError } from '../errors/SerializationError';
import { PositionIdentityService } from './PositionIdentityService';

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SerializationError('Invalid JSON payload.', error);
  }
}
function parseWithSchema<T>(artefactName: string, parse: (input: unknown) => T, input: unknown): T {
  try {
    return parse(input);
  } catch (error) {
    throw new SerializationError(`${artefactName} payload is invalid.`, error);
  }
}
function requireSchemaVersionOne(input: unknown, artefactName: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new SerializationError(`${artefactName} payload must be an object.`, input);
  const schemaVersion = (input as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== 1) throw new SerializationError(`${artefactName} schema version is unsupported.`, schemaVersion);
  return input as Record<string, unknown>;
}
function validateMoveNode(node: IMoveNode): void {
  if (node.mainlineChildIndex !== undefined && (node.mainlineChildIndex < 0 || node.mainlineChildIndex >= node.children.length)) {
    throw new SerializationError('Move tree mainline child index must reference an existing child.', node.mainlineChildIndex);
  }
  for (const child of node.children) validateMoveNode(child);
}
function getNodeAtPath(tree: IMoveTree, path: MovePath, selectorName: string): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) {
    const childNode = currentNode.children[childIndex];
    if (childNode === undefined) throw new SerializationError(`${selectorName} must reference an existing move-tree node.`, path);
    currentNode = childNode;
  }
  return currentNode;
}
function validateMoveTree(tree: IMoveTree): void {
  validateMoveNode(tree.root);
}
function validateGame(game: IGame): void {
  validateMoveTree(game.moveTree);
  getNodeAtPath(game.moveTree, game.highlightPath, 'Saved game highlightPath');
  if (game.livePath !== undefined) getNodeAtPath(game.moveTree, game.livePath, 'Saved game livePath');
  if (PositionIdentityService.buildPositionKey(game.moveTree.root.position) !== PositionIdentityService.buildPositionKey(game.boardRoot)) {
    throw new SerializationError('Saved game boardRoot must match the move-tree root position.');
  }
}
function validateGameSession(snapshot: IGameSessionSnapshot): void {
  if (snapshot.activeGameId !== undefined && !snapshot.openGameIds.includes(snapshot.activeGameId)) {
    throw new SerializationError('Active game id must be included in the open game id list.');
  }
}
function migrateSettingsSnapshot(input: unknown): ISettingsSnapshot {
  requireSchemaVersionOne(input, 'Settings');
  return parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), input);
}
function migrateGameSessionSnapshot(input: unknown): IGameSessionSnapshot {
  requireSchemaVersionOne(input, 'Game session');
  const snapshot = parseWithSchema<IGameSessionSnapshot>('Game session', (value) => gameSessionSnapshotSchema.parse(value) as IGameSessionSnapshot, input);
  validateGameSession(snapshot);
  return snapshot;
}
function migrateUiLayoutState(input: unknown): IUiLayoutState {
  requireSchemaVersionOne(input, 'UI layout state');
  return parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), input);
}
function migrateGame(input: unknown): IGame {
  requireSchemaVersionOne(input, 'Saved game');
  const game = parseWithSchema('Saved game', (value) => gameSchema.parse(value), input);
  validateGame(game);
  return game;
}
function stripRuntimeMetadata<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => stripRuntimeMetadata(item)) as T;
  if (typeof input !== 'object' || input === null) return input;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === '$') continue;
    output[key] = stripRuntimeMetadata(value);
  }
  return output as T;
}
function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}
async function writeDocument(path: string, raw: string, overwrite: boolean): Promise<void> {
  await usePlatformService().getStorageAdapter().writeTextFile(path, raw, overwrite);
}

export const SerializationService = {
  async readSettingsDocument(path: string): Promise<ISettingsSnapshot> {
    return this.deserialiseSettings(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeSettingsDocument(path: string, snapshot: ISettingsSnapshot): Promise<void> {
    await writeDocument(path, this.serialiseSettings(snapshot), true);
  },
  async readGameSessionDocument(path: string): Promise<IGameSessionSnapshot> {
    return this.deserialiseGameSession(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeGameSessionDocument(path: string, snapshot: IGameSessionSnapshot): Promise<void> {
    await writeDocument(path, this.serialiseGameSession(snapshot), true);
  },
  async readUiLayoutDocument(path: string): Promise<IUiLayoutState> {
    return this.deserialiseUiLayoutState(await usePlatformService().getStorageAdapter().readTextFile(path));
  },
  async writeUiLayoutDocument(path: string, state: IUiLayoutState): Promise<void> {
    await writeDocument(path, this.serialiseUiLayoutState(state), true);
  },
  async readGameDocument(filePath: string): Promise<IGame> {
    return this.deserialiseGame(await usePlatformService().getStorageAdapter().readTextFile(filePath));
  },
  async writeGameDocument(filePath: string, game: IGame, overwrite: boolean = false): Promise<void> {
    await writeDocument(filePath, this.serialiseGame(game), overwrite);
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
      if (isPlatformError(error) && error.kind === PlatformErrorKind.NotFound) return new Map();
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
    const persistedSnapshot = stripRuntimeMetadata(parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), snapshot));
    return JSON.stringify(persistedSnapshot, null, 2);
  },
  deserialiseSettings(raw: string): ISettingsSnapshot {
    return this.migrateSettingsSnapshot(parseJson(raw));
  },
  serialiseGameSession(snapshot: IGameSessionSnapshot): string {
    validateGameSession(snapshot);
    const persistedSnapshot = stripRuntimeMetadata(parseWithSchema('Game session', (value) => gameSessionSnapshotSchema.parse(value), snapshot));
    return JSON.stringify(persistedSnapshot, null, 2);
  },
  deserialiseGameSession(raw: string): IGameSessionSnapshot {
    return this.migrateGameSessionSnapshot(parseJson(raw));
  },
  serialiseUiLayoutState(state: IUiLayoutState): string {
    const persistedState = stripRuntimeMetadata(parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), state));
    return JSON.stringify(persistedState, null, 2);
  },
  deserialiseUiLayoutState(raw: string): IUiLayoutState {
    return this.migrateUiLayoutState(parseJson(raw));
  },
  serialiseGame(game: IGame): string {
    const persistedGame = parseWithSchema('Saved game', (value) => gameSchema.parse(value), stripRuntimeMetadata(game));
    validateGame(persistedGame);
    return JSON.stringify(persistedGame, null, 2);
  },
  deserialiseGame(raw: string): IGame {
    return this.migrateGame(parseJson(raw));
  },
  migrateSettingsSnapshot,
  migrateGameSessionSnapshot,
  migrateUiLayoutState,
  migrateGame,
};
