import {
  gameWorkspaceSchema,
  settingsSnapshotSchema,
  gameSessionSnapshotSchema,
  uiLayoutStateSchema,
  type IGameSessionSnapshot,
  type IGameWorkspace,
  type IMoveNode,
  type IMoveTree,
  type ISettingsSnapshot,
  type IUiLayoutState,
  type MovePath,
} from '../../contracts';
import { normaliseBoardPosition } from '@/utility/chess/BoardUtility';

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
function normaliseMoveNode(node: IMoveNode): IMoveNode {
  return {
    branchKind: node.branchKind,
    move: node.move === null ? null : structuredClone(node.move),
    position: normaliseBoardPosition(node.position),
    clockSnapshot: node.clockSnapshot === null ? null : structuredClone(node.clockSnapshot),
    plyIndex: node.plyIndex,
    mainlineChildIndex: node.mainlineChildIndex,
    children: node.children.map((child) => normaliseMoveNode(child)),
  };
}
function normaliseMoveTree(tree: IMoveTree): IMoveTree {
  return { root: normaliseMoveNode(tree.root) };
}
function validateMoveNode(node: IMoveNode): void {
  if (node.mainlineChildIndex !== null && (node.mainlineChildIndex < 0 || node.mainlineChildIndex >= node.children.length)) {
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
function normaliseWorkspace(workspace: IGameWorkspace): IGameWorkspace {
  return {
    ...structuredClone(workspace),
    boardRoot: normaliseBoardPosition(workspace.boardRoot),
    moveTree: normaliseMoveTree(workspace.moveTree),
  };
}
function validateWorkspace(workspace: IGameWorkspace): void {
  validateMoveTree(workspace.moveTree);
  getNodeAtPath(workspace.moveTree, workspace.highlightPath, 'Saved game highlightPath');
  if (workspace.livePath !== null) getNodeAtPath(workspace.moveTree, workspace.livePath, 'Saved game livePath');
  if (PositionIdentityService.buildPositionKey(workspace.moveTree.root.position) !== PositionIdentityService.buildPositionKey(workspace.boardRoot)) {
    throw new SerializationError('Saved game boardRoot must match the move-tree root position.');
  }
}
function validateGameSession(snapshot: IGameSessionSnapshot): void {
  if (snapshot.activeGameId !== null && !snapshot.openGameIds.includes(snapshot.activeGameId)) {
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
function migrateGame(input: unknown): IGameWorkspace {
  requireSchemaVersionOne(input, 'Saved game');
  const workspace = normaliseWorkspace(parseWithSchema('Saved game', (value) => gameWorkspaceSchema.parse(value), input));
  validateWorkspace(workspace);
  return workspace;
}

export const SerializationService = {
  serialiseSettings(snapshot: ISettingsSnapshot): string {
    return JSON.stringify(parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), snapshot), null, 2);
  },
  deserialiseSettings(raw: string): ISettingsSnapshot {
    return this.migrateSettingsSnapshot(parseJson(raw));
  },
  serialiseGameSession(snapshot: IGameSessionSnapshot): string {
    validateGameSession(snapshot);
    return JSON.stringify(parseWithSchema('Game session', (value) => gameSessionSnapshotSchema.parse(value), snapshot), null, 2);
  },
  deserialiseGameSession(raw: string): IGameSessionSnapshot {
    return this.migrateGameSessionSnapshot(parseJson(raw));
  },
  serialiseUiLayoutState(state: IUiLayoutState): string {
    return JSON.stringify(parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), state), null, 2);
  },
  deserialiseUiLayoutState(raw: string): IUiLayoutState {
    return this.migrateUiLayoutState(parseJson(raw));
  },
  serialiseGame(workspace: IGameWorkspace): string {
    const normalisedWorkspace = normaliseWorkspace(parseWithSchema('Saved game', (value) => gameWorkspaceSchema.parse(value), workspace));
    validateWorkspace(normalisedWorkspace);
    return JSON.stringify(normalisedWorkspace, null, 2);
  },
  deserialiseGame(raw: string): IGameWorkspace {
    return this.migrateGame(parseJson(raw));
  },
  migrateSettingsSnapshot,
  migrateGameSessionSnapshot,
  migrateUiLayoutState,
  migrateGame,
};
