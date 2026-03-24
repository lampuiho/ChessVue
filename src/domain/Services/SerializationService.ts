import {
  gameWorkspaceSchema,
  recentGamesSnapshotSchema,
  settingsSnapshotSchema,
  gameSessionSnapshotSchema,
  uiLayoutStateSchema,
  type IGameSessionSnapshot,
  type IGameWorkspace,
  type IMoveTree,
  type IRecentGamesSnapshot,
  type ISettingsSnapshot,
  type IUiLayoutState,
} from '../Contracts'
import { SerializationError } from '../Errors/SerializationError'
import { normaliseBoardPosition } from '../Internal/Board'

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new SerializationError('Invalid JSON payload.', error)
  }
}

function parseWithSchema<T>(artefactName: string, parse: (input: unknown) => T, input: unknown): T {
  try {
    return parse(input)
  } catch (error) {
    throw new SerializationError(`${artefactName} payload is invalid.`, error)
  }
}

function requireSchemaVersionOne(input: unknown, artefactName: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SerializationError(`${artefactName} payload must be an object.`, input)
  }

  const schemaVersion = (input as { schemaVersion?: unknown }).schemaVersion
  if (schemaVersion !== 1) {
    throw new SerializationError(`${artefactName} schema version is unsupported.`, schemaVersion)
  }

  return input as Record<string, unknown>
}

function normaliseMoveTree(tree: IMoveTree): IMoveTree {
  const normalisedTree: IMoveTree = {
    rootId: tree.rootId,
    nodeById: {},
  }

  for (const [nodeId, node] of Object.entries(tree.nodeById)) {
    normalisedTree.nodeById[nodeId] = {
      ...structuredClone(node),
      position: normaliseBoardPosition(node.position),
      childIds: [...node.childIds],
      clockSnapshot: node.clockSnapshot === null ? null : structuredClone(node.clockSnapshot),
    }
  }

  return normalisedTree
}

function validateMoveTree(tree: IMoveTree): void {
  const root = tree.nodeById[tree.rootId]
  if (root === undefined) {
    throw new SerializationError('Move tree rootId must reference an existing node.')
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      throw new SerializationError('Move tree contains a cycle.', nodeId)
    }

    if (visited.has(nodeId)) {
      return
    }

    const node = tree.nodeById[nodeId]
    if (node === undefined) {
      throw new SerializationError('Move tree references a missing node.', nodeId)
    }

    if (node.id !== nodeId) {
      throw new SerializationError('Move tree node id does not match its record key.', { nodeId, nodeRecordId: node.id })
    }

    if (node.mainlineChildId !== null && !node.childIds.includes(node.mainlineChildId)) {
      throw new SerializationError('Move tree mainline child must be one of the node childIds.', nodeId)
    }

    visiting.add(nodeId)

    for (const childId of node.childIds) {
      const child = tree.nodeById[childId]
      if (child === undefined) {
        throw new SerializationError('Move tree references a missing child node.', { nodeId, childId })
      }

      if (child.parentId !== nodeId) {
        throw new SerializationError('Move tree child parentId does not match the parent node.', { nodeId, childId, parentId: child.parentId })
      }

      visit(childId)
    }

    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  visit(tree.rootId)

  if (visited.size !== Object.keys(tree.nodeById).length) {
    throw new SerializationError('Move tree contains unreachable nodes.')
  }
}

function normaliseWorkspace(workspace: IGameWorkspace): IGameWorkspace {
  const normalisedBoardRoot = normaliseBoardPosition(workspace.boardRoot)
  const normalisedMoveTree = normaliseMoveTree(workspace.moveTree)

  return {
    ...structuredClone(workspace),
    boardRoot: normalisedBoardRoot,
    moveTree: normalisedMoveTree,
  }
}

function validateWorkspace(workspace: IGameWorkspace): void {
  validateMoveTree(workspace.moveTree)

  if (workspace.moveTree.nodeById[workspace.visibleNodeId] === undefined) {
    throw new SerializationError('Saved game visibleNodeId must reference an existing move-tree node.')
  }

  if (workspace.liveNodeId !== null && workspace.moveTree.nodeById[workspace.liveNodeId] === undefined) {
    throw new SerializationError('Saved game liveNodeId must reference an existing move-tree node when present.')
  }

  const rootNode = workspace.moveTree.nodeById[workspace.moveTree.rootId]
  if (rootNode.position.fen !== workspace.boardRoot.fen) {
    throw new SerializationError('Saved game boardRoot must match the move-tree root position.')
  }
}

function normaliseRecentGames(snapshot: IRecentGamesSnapshot): IRecentGamesSnapshot {
  const byGameId = new Map<string, IRecentGamesSnapshot['entries'][number]>()
  const sortedEntries = [...snapshot.entries].sort((left, right) => Date.parse(right.lastSavedAtUtc) - Date.parse(left.lastSavedAtUtc))

  for (const entry of sortedEntries) {
    if (!byGameId.has(entry.gameId)) {
      byGameId.set(entry.gameId, structuredClone(entry))
    }
  }

  return {
    schemaVersion: 1,
    entries: [...byGameId.values()],
  }
}

function validateGameSession(snapshot: IGameSessionSnapshot): void {
  if (snapshot.activeGameId !== null && !snapshot.openGameIds.includes(snapshot.activeGameId)) {
    throw new SerializationError('Active game id must be included in the open game id list.')
  }
}

function migrateSettingsSnapshot(input: unknown): ISettingsSnapshot {
  requireSchemaVersionOne(input, 'Settings')
  return parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), input)
}

function migrateRecentGamesSnapshot(input: unknown): IRecentGamesSnapshot {
  requireSchemaVersionOne(input, 'Recent games')
  return normaliseRecentGames(parseWithSchema('Recent games', (value) => recentGamesSnapshotSchema.parse(value), input))
}

function migrateGameSessionSnapshot(input: unknown): IGameSessionSnapshot {
  requireSchemaVersionOne(input, 'Game session')
  const snapshot = parseWithSchema('Game session', (value) => gameSessionSnapshotSchema.parse(value), input)
  validateGameSession(snapshot)
  return snapshot
}

function migrateUiLayoutState(input: unknown): IUiLayoutState {
  requireSchemaVersionOne(input, 'UI layout state')
  return parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), input)
}

function migrateGame(input: unknown): IGameWorkspace {
  requireSchemaVersionOne(input, 'Saved game')
  const workspace = normaliseWorkspace(parseWithSchema('Saved game', (value) => gameWorkspaceSchema.parse(value), input))
  validateWorkspace(workspace)
  return workspace
}

export const SerializationService = {
  serialiseSettings(snapshot: ISettingsSnapshot): string {
    return JSON.stringify(parseWithSchema('Settings', (value) => settingsSnapshotSchema.parse(value), snapshot), null, 2)
  },

  deserialiseSettings(raw: string): ISettingsSnapshot {
    return this.migrateSettingsSnapshot(parseJson(raw))
  },

  serialiseRecentGames(snapshot: IRecentGamesSnapshot): string {
    return JSON.stringify(normaliseRecentGames(parseWithSchema('Recent games', (value) => recentGamesSnapshotSchema.parse(value), snapshot)), null, 2)
  },

  deserialiseRecentGames(raw: string): IRecentGamesSnapshot {
    return this.migrateRecentGamesSnapshot(parseJson(raw))
  },

  serialiseGameSession(snapshot: IGameSessionSnapshot): string {
    validateGameSession(snapshot)
    return JSON.stringify(parseWithSchema('Game session', (value) => gameSessionSnapshotSchema.parse(value), snapshot), null, 2)
  },

  deserialiseGameSession(raw: string): IGameSessionSnapshot {
    return this.migrateGameSessionSnapshot(parseJson(raw))
  },

  serialiseUiLayoutState(state: IUiLayoutState): string {
    return JSON.stringify(parseWithSchema('UI layout state', (value) => uiLayoutStateSchema.parse(value), state), null, 2)
  },

  deserialiseUiLayoutState(raw: string): IUiLayoutState {
    return this.migrateUiLayoutState(parseJson(raw))
  },

  serialiseGame(workspace: IGameWorkspace): string {
    const normalisedWorkspace = normaliseWorkspace(parseWithSchema('Saved game', (value) => gameWorkspaceSchema.parse(value), workspace))
    validateWorkspace(normalisedWorkspace)
    return JSON.stringify(normalisedWorkspace, null, 2)
  },

  deserialiseGame(raw: string): IGameWorkspace {
    return this.migrateGame(parseJson(raw))
  },

  migrateSettingsSnapshot,
  migrateRecentGamesSnapshot,
  migrateGameSessionSnapshot,
  migrateUiLayoutState,
  migrateGame,
}

