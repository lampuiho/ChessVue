import {
  AnalysisBranchExitBehaviour,
  BoardOrientation,
  DrawOfferDirection,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  GameState,
  MoveNodeKind,
  MoveKind,
  PieceKind,
  PlayerActivityState,
  PlayerColour,
  PlayerType,
  PromotionPolicy,
  RecentGameSourceKind,
  ResultState,
  ThemeMode,
  TimeControlPreset,
  type IAnalysisSeat,
  type IAssignedEngine,
  type IClockSnapshot,
  type IEngineAnalysisUpdate,
  type IEngineRecord,
  type IGame,
  type IGameSessionSnapshot,
  type IMove,
  type IMoveNode,
  type IMoveTree,
  type IRecentGameEntry,
  type ISettingsSnapshot,
  type IUiLayoutState,
} from '@/contracts';
import type { ISavedGameFileEntry, ISavedGameGroup } from '@/contracts/domain';
import { PlatformErrorKind, type IPlatformError } from '@/contracts/PlatformError';
import { AnalysisTimestamp, ClockTimestamp, RecordTimestamp, SaveTimestamp } from '@/utility/date';

export async function randomDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1 + Math.floor(Math.random() * 4)));
}
export async function resolveWithRandomDelay<T>(value: T): Promise<T> {
  await randomDelay();
  return structuredClone(value);
}
export async function rejectWithRandomDelay(error: unknown): Promise<never> {
  await randomDelay();
  throw error;
}
export function createPlatformError(kind: PlatformErrorKind, message: string, operation: string = 'test'): IPlatformError {
  return { kind, message, operation };
}
export function createEngineRecord(id: string = 'engine-a', displayName: string = 'Stockfish'): IEngineRecord {
  return {
    id,
    displayName,
    executablePath: `${displayName.toLowerCase().replace(/\s+/g, '-')}.exe`,
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 1 },
  };
}
export function createAssignedEngine(engine: IEngineRecord = createEngineRecord()): IAssignedEngine {
  return {
    displayName: engine.displayName,
    executablePath: engine.executablePath,
    clientType: engine.clientType,
    protocol: engine.protocol,
    options: structuredClone(engine.options),
    $: {
      availability: EngineAvailability.Unavailable,
      analysisLines: new Map(),
    },
  };
}
export function createSettingsSnapshot(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: {
      restorePreviousSession: true,
      saveRootPath: 'saves',
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
    },
    gameplay: {
      analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode,
      promotionPolicy: PromotionPolicy.RequireExplicitSelection,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [
        createEngineRecord('engine-a', 'Stockfish'),
        createEngineRecord('engine-b', 'Lc0'),
      ],
    },
    appearance: {
      themeMode: ThemeMode.System,
      boardTheme: 'classic',
      pieceTheme: 'classic',
      uiScalePercent: 100,
      boardOrientation: BoardOrientation.White,
      showCoordinates: true,
      highlightLastMove: true,
    },
  };
}
export function createBoardPosition(sideToMove: PlayerColour = PlayerColour.White): IGame['rootPosition'] {
  return {
    board: Array.from({ length: 64 }, () => undefined),
    sideToMove,
    castlingAvailability: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
    halfMoveClock: 0,
    fullMoveNumber: 1,
  };
}
export function createClockSnapshot(activeColour?: PlayerColour, isRunning: boolean = false): IClockSnapshot {
  return {
    white: { remainingMs: 300000, isRunning: isRunning && activeColour === PlayerColour.White },
    black: { remainingMs: 300000, isRunning: isRunning && activeColour === PlayerColour.Black },
    activeColour,
    startedAtUtc: activeColour ? new ClockTimestamp('2026-04-17T12:00:00.000Z') : undefined,
  };
}
export function createMove(movingColour: PlayerColour = PlayerColour.White, from: number = 12, to: number = 28): IMove {
  return {
    from,
    to,
    kind: MoveKind.Normal,
    movingColour,
    movingPiece: PieceKind.Pawn,
    $: { san: `${from}-${to}`, uci: `${from}-${to}` },
  };
}
export function createMoveTree(rootClockSnapshot?: IClockSnapshot): IMoveTree {
  return {
    root: {
      kind: MoveNodeKind.Live,
      clockSnapshot: rootClockSnapshot ? structuredClone(rootClockSnapshot) : undefined,
      plyIndex: 0,
      children: [],
    },
  };
}
export function attachParents(node: IMoveNode, parent?: IMoveNode): IMoveNode {
  node.$ = parent ? { parent } : undefined;
  for (const child of node.children) attachParents(child, node);
  return node;
}
export function getNodeAtPath(tree: IMoveTree, path: number[]): IMoveNode {
  let currentNode = tree.root;
  for (const childIndex of path) currentNode = currentNode.children[childIndex]!;
  return currentNode;
}
export function getPathToNode(node: IMoveNode): number[] {
  const path: number[] = [];
  let currentNode: IMoveNode | undefined = node;
  while (currentNode?.$?.parent) {
    const parentNode: IMoveNode = currentNode.$.parent;
    path.unshift(parentNode.children.indexOf(currentNode));
    currentNode = parentNode;
  }
  return path;
}
export function appendChild(parent: IMoveNode, move: IMove, kind: MoveNodeKind, clockSnapshot?: IClockSnapshot): IMoveNode {
  const child: IMoveNode = {
    kind,
    move: structuredClone(move),
    clockSnapshot: clockSnapshot ? structuredClone(clockSnapshot) : undefined,
    plyIndex: parent.plyIndex + 1,
    children: [],
    $: { parent },
  };
  parent.children.push(child);
  parent.mainlineChildIndex = parent.children.length - 1;
  return child;
}
export function getRootNode(node: IMoveNode): IMoveNode {
  let currentNode = node;
  while (currentNode.$?.parent) currentNode = currentNode.$.parent;
  return currentNode;
}
export function cloneTree(tree: IMoveTree): IMoveTree {
  return { root: attachParents(structuredClone(tree.root)) };
}
export function createAnalysisSeat(engine: IEngineRecord = createEngineRecord()): IAnalysisSeat {
  return {
    assignedEngine: createAssignedEngine(engine),
    updatedAt: new AnalysisTimestamp('2026-04-17T12:00:00.000Z'),
    lines: [],
    isComplete: false,
  };
}
export function createGame(overrides: Partial<IGame> = {}): IGame {
  const rootPosition = structuredClone(overrides.rootPosition ?? createBoardPosition());
  const clockSnapshot = structuredClone(overrides.clockSnapshot ?? createClockSnapshot(rootPosition.sideToMove, false));
  const moveTree = cloneTree(overrides.moveTree ?? createMoveTree(clockSnapshot));
  return {
    schemaVersion: 1,
    metadata: {
      id: overrides.metadata?.id ?? 'game-1',
      name: overrides.metadata?.name ?? 'Example Game',
      createdAt: overrides.metadata?.createdAt ?? new RecordTimestamp('2026-04-17T12:00:00.000Z'),
      updatedAt: overrides.metadata?.updatedAt ?? new RecordTimestamp('2026-04-17T12:00:00.000Z'),
    },
    gameState: overrides.gameState ?? GameState.LiveWhiteTurn,
    resultState: overrides.resultState ?? ResultState.Ongoing,
    resultReason: overrides.resultReason,
    drawOfferState: overrides.drawOfferState ? structuredClone(overrides.drawOfferState) : undefined,
    whitePlayer: overrides.whitePlayer ?? {
      colour: PlayerColour.White,
      type: PlayerType.Local,
      displayName: 'White',
      $: { activityState: PlayerActivityState.Active },
    },
    blackPlayer: overrides.blackPlayer ?? {
      colour: PlayerColour.Black,
      type: PlayerType.Local,
      displayName: 'Black',
      $: { activityState: PlayerActivityState.Active },
    },
    rootPosition,
    moveTree,
    livePath: overrides.livePath ? [...overrides.livePath] : [],
    renderedPath: overrides.renderedPath ? [...overrides.renderedPath] : [],
    timeControl: structuredClone(overrides.timeControl ?? { preset: TimeControlPreset.Untimed, incrementMs: 0 }),
    clockSnapshot,
    gameplayOptions: structuredClone(overrides.gameplayOptions ?? { allowTakeback: false, showLiveAnalysisMoves: false }),
    analysis: structuredClone(overrides.analysis ?? { seats: [] }),
    $: overrides.$ ? structuredClone(overrides.$) : undefined,
  };
}
export function createGameSessionSnapshot(overrides: Partial<IGameSessionSnapshot> = {}): IGameSessionSnapshot {
  return {
    schemaVersion: 1,
    openGameIds: overrides.openGameIds ? [...overrides.openGameIds] : [],
    activeGameId: overrides.activeGameId,
    activeRoute: overrides.activeRoute ?? '/home',
  };
}
export function createUiLayoutState(overrides: Partial<IUiLayoutState> = {}): IUiLayoutState {
  return {
    schemaVersion: 1,
    showHistoryPanel: overrides.showHistoryPanel ?? true,
    showAnalysisPanel: overrides.showAnalysisPanel ?? true,
    historyCollapsed: overrides.historyCollapsed ?? false,
    analysisCollapsed: overrides.analysisCollapsed ?? false,
    analysisEngineExpandedByIndex: overrides.analysisEngineExpandedByIndex ? [...overrides.analysisEngineExpandedByIndex] : [],
  };
}
export function createSavedGameEntry(gameId: string, saveName: string, savedAtUtc: string, isAutosave: boolean, filePath: string): ISavedGameFileEntry {
  return { gameId, saveName, savedAtUtc: new SaveTimestamp(savedAtUtc), isAutosave, filePath };
}
export function createSavedGameGroup(gameId: string, saves: ISavedGameFileEntry[]): ISavedGameGroup {
  return {
    gameId,
    gameFolderPath: `saves/${gameId}`,
    saves: structuredClone(saves),
  };
}
export function createRecentGameEntry(overrides: Partial<IRecentGameEntry> = {}): IRecentGameEntry {
  return {
    gameId: overrides.gameId ?? 'game-1',
    displayName: overrides.displayName ?? 'Example Game',
    sourceKind: overrides.sourceKind ?? RecentGameSourceKind.SaveFile,
    filePath: overrides.filePath ?? 'saves/game-1/manual.json',
    lastSavedAtUtc: overrides.lastSavedAtUtc ?? new SaveTimestamp('2026-04-17T12:00:00.000Z'),
  };
}
export function createOutgoingDrawOffer(colour: PlayerColour): IGame['drawOfferState'] {
  return {
    offeringColour: colour,
    respondingColour: colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White,
    direction: DrawOfferDirection.Outgoing,
  };
}
export function emitAnalysisUpdate(registry: Map<IAssignedEngine, (update: IEngineAnalysisUpdate) => void>, engine: IAssignedEngine, update: IEngineAnalysisUpdate): void {
  registry.get(engine)?.(update);
}
export function stripRuntimeMetadata<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => stripRuntimeMetadata(item)) as T;
  if (input instanceof Date) return input;
  if (typeof input !== 'object' || input === null) return input;
  if (input instanceof Map) return new Map(input) as T;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === '$') continue;
    output[key] = stripRuntimeMetadata(value);
  }
  return output as T;
}
