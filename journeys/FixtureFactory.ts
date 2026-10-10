import { AnalysisBranchExitBehaviour, BoardOrientation, EngineClientType, EngineProtocol, GameState, PlayerColour, PlayerType, PromotionPolicy, ResultState, ThemeMode, TimeControlPreset, type IBoardPosition, type IEngineRecord, type IGame, type IGameSessionSnapshot, type ISettingsSnapshot, type ITimeControl, type IUiLayoutState, type MovePath } from '@/contracts';
import { MoveHistoryService } from '@/domain/MoveHistoryService';
import { SerializationService } from '@/domain/SerializationService';
import { TimeControlService } from '@/domain/TimeControlService';
import { applyMove, createInitialBoardPosition, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';
import { ClockTimestamp, RecordTimestamp } from '@/utility/date';
import type { IJourneyFile, IJourneySeed } from './Journey';

export const fixtureTimestamp = '2026-10-01T12:00:00.000Z';
export const engineProfiles: IEngineRecord[] = ['A', 'B', 'unavailable'].map((name) => ({
  id: `journey-${name.toLowerCase()}`, displayName: `Journey ${name}`, executablePath: `journey://${name.toLowerCase()}`,
  clientType: EngineClientType.Uci, protocol: EngineProtocol.Uci, options: { MultiPV: 3, Hash: 16 },
}));
interface IGameOptions {
  rootPosition?: IBoardPosition;
  state?: GameState;
  freeAnalysis?: boolean;
  timeControl?: ITimeControl;
  allowTakeback?: boolean;
}
export function createSettings(): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: { restorePreviousSession: true, saveRootPath: 'saves', autosaveAfterMoveCount: 1, autosaveOnClose: true, autoPauseOnMenu: true },
    gameDefaults: { quickNewGameName: 'New Game', defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 }, defaultWhitePlayerType: PlayerType.Local, defaultBlackPlayerType: PlayerType.Local },
    gameplay: { analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode, promotionPolicy: PromotionPolicy.RequireExplicitSelection },
    analysis: { resumeLiveAnalysisAfterRestore: true, engineInventory: structuredClone(engineProfiles) },
    appearance: { themeMode: ThemeMode.System, boardTheme: 'classic', pieceTheme: 'classic', uiScalePercent: 100, boardOrientation: BoardOrientation.White, showCoordinates: true, highlightLastMove: true },
  };
}
export function createGame(id: string, name: string, moves: string[] = [], options: IGameOptions = {}): IGame {
  const rootPosition = options.rootPosition ?? createInitialBoardPosition();
  const timeControl = options.timeControl ?? { preset: TimeControlPreset.Untimed, incrementMs: 0 };
  const clockSnapshot = TimeControlService.initialiseClockSnapshot(timeControl);
  const game: IGame = {
    schemaVersion: 1, metadata: { id, name, createdAt: new RecordTimestamp(fixtureTimestamp), updatedAt: new RecordTimestamp(fixtureTimestamp) },
    gameState: GameState.LiveWhiteTurn, resultState: ResultState.Ongoing,
    whitePlayer: options.freeAnalysis ? undefined : { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
    blackPlayer: options.freeAnalysis ? undefined : { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
    rootPosition, moveTree: MoveHistoryService.createMoveTree(clockSnapshot), livePath: options.freeAnalysis ? undefined : [], renderedPath: [],
    timeControl, clockSnapshot, gameplayOptions: { allowTakeback: options.allowTakeback ?? true, showLiveAnalysisMoves: false }, analysis: { seats: [] },
  };
  appendMoves(game, [], moves, !options.freeAnalysis);
  const side = getPosition(game, game.renderedPath).sideToMove;
  game.gameState = options.state ?? (options.freeAnalysis
    ? side === PlayerColour.White ? GameState.AnalysisWhiteMove : GameState.AnalysisBlackMove
    : side === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn);
  return game;
}
export function getPosition(game: IGame, path: MovePath): IBoardPosition {
  const position = structuredClone(game.rootPosition);
  for (const move of MoveHistoryService.getMoveSequence(game.moveTree, path)) applyMove(position, move);
  return position;
}
export function appendMoves(game: IGame, fromPath: MovePath, moves: string[], live = false): MovePath {
  const path = [...fromPath];
  const position = getPosition(game, path);
  let node = game.moveTree.root;
  for (const index of path) node = node.children[index]!;
  for (const uci of moves) {
    const raw = genLegalMoves(position).find((move) => getUci(move) === uci);
    if (!raw) throw new Error(`Illegal fixture move ${uci} in ${game.metadata.id}.`);
    const move = toDetailedMove(position, raw);
    const nextIndex = node.children.length;
    node = live ? MoveHistoryService.addMainlineMove(node, move, game.clockSnapshot) : MoveHistoryService.addAnalysisMove(node, move);
    path.push(nextIndex);
    applyMove(position, move);
  }
  if (live) game.livePath = path;
  if (live || game.livePath === undefined) game.renderedPath = [...path];
  return path;
}
export function setPausedClock(game: IGame, remainingMs: number, now: number): void {
  const colour = getPosition(game, game.livePath ?? game.renderedPath).sideToMove;
  game.clockSnapshot = {
    white: { remainingMs, isRunning: false }, black: { remainingMs, isRunning: false },
    activeColour: colour, pausedAtUtc: new ClockTimestamp(now),
  };
  game.gameState = colour === PlayerColour.White ? GameState.PausedWhiteTurn : GameState.PausedBlackTurn;
  let node = game.moveTree.root;
  for (const index of game.livePath ?? []) node = node.children[index]!;
  node.clockSnapshot = game.clockSnapshot;
}
interface IWorkspaceOptions {
  route?: IGameSessionSnapshot['activeRoute'];
  openGameIds?: string[];
  settings?: ISettingsSnapshot;
  layout?: Partial<IUiLayoutState>;
  files?: IJourneyFile[];
}
export function createWorkspace(games: IGame[], options: IWorkspaceOptions = {}): IJourneySeed {
  const gameIds = games.map((game) => game.metadata.id);
  const openGameIds = options.openGameIds ?? gameIds;
  const activeRoute = options.route ?? (openGameIds[0] ? `/game/${openGameIds[0]}` : '/home');
  const session: IGameSessionSnapshot = { schemaVersion: 1, openGameIds, activeGameId: openGameIds[0], activeRoute };
  const layout: IUiLayoutState = { schemaVersion: 1, showHistoryPanel: true, showAnalysisPanel: true, historyCollapsed: false, analysisCollapsed: false, analysisEngineExpandedByIndex: [true, true], ...options.layout };
  const files: IJourneyFile[] = [
    { path: 'settings.json', raw: SerializationService.serialiseSettings(options.settings ?? createSettings()) },
    { path: 'game-session.json', raw: SerializationService.serialiseGameSession(session) },
    { path: 'layout-state.json', raw: SerializationService.serialiseUiLayoutState(layout) },
    ...games.map((game) => saveFile(game)),
  ];
  for (const file of options.files ?? []) {
    const existingIndex = files.findIndex((existing) => existing.path === file.path);
    if (existingIndex >= 0) files.splice(existingIndex, 1);
    files.push(file);
  }
  return { files, gameIds, activeRoute };
}
export function saveFile(game: IGame, name = 'auto', modifiedAt = Date.parse(fixtureTimestamp)): IJourneyFile {
  return { path: `saves/${game.metadata.id}/${name}.json`, raw: SerializationService.serialiseGame(game), modifiedAt };
}
