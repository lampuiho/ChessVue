import { ref } from 'vue';
import {
  ResultState,
  type ICreateGameRequest,
  type IGame,
  type IStartGameFromSetupRequest,
  type MovePath,
  type ReadonlyGame,
} from '@/contracts';
import { MoveHistoryService, PositionIdentityService, UserSettingService } from '@/domain';
import { createInitialBoardPosition } from '@/utility/chess';
import { ClockTimestamp, RecordTimestamp } from '@/utility/date';
import type { GameAnalysisComposable } from './GameAnalysisComposable';
import type { GameClockComposable } from './GameClockComposable';
import type { GamePlayerTurnComposable } from './GamePlayerTurnComposable';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGameWorkspaceDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  clock: GameClockComposable;
  analysis: GameAnalysisComposable;
  playerTurn: GamePlayerTurnComposable;
  touchGame: (game: IGame) => void;
}

export function useGameWorkspace(dependency: IGameWorkspaceDependency) {
  const { position, status, clock, analysis, playerTurn, touchGame } = dependency;
  const games = ref<IGame[]>([]);
  function createGameMetadata(name: string, nowUtc: Date) {
    return {
      id: crypto.randomUUID(),
      name,
      createdAt: new RecordTimestamp(nowUtc),
      updatedAt: new RecordTimestamp(nowUtc),
    };
  }
  /** Insertion transfers ownership; duplicate repair mutates that supplied game before it enters the store. */
  function repairDuplicateGameId(game: IGame, existingGameIds: ReadonlySet<string>): void {
    if (!existingGameIds.has(game.metadata.id)) return;
    game.metadata.id = crypto.randomUUID();
    game.metadata.updatedAt = new RecordTimestamp();
  }
  function getGameIndex(gameId: string): number {
    return games.value.findIndex((game) => game.metadata.id === gameId);
  }
  function getExistingGameIds(excludedGameId?: string): Set<string> {
    return new Set(games.value.filter((game) => game.metadata.id !== excludedGameId).map((game) => game.metadata.id));
  }
  function replaceGame(game: IGame): void {
    const gameIndex = getGameIndex(game.metadata.id);
    if (gameIndex >= 0) games.value.splice(gameIndex, 1, game);
    else games.value.push(game);
  }
  async function hydrateAndInsertGame(game: IGame): Promise<IGame> {
    repairDuplicateGameId(game, getExistingGameIds());
    const hydratedGame = position.hydrateGame(game);
    playerTurn.normalisePlayers(hydratedGame);
    replaceGame(hydratedGame);
    clock.refreshRuntimeRegistrations(hydratedGame);
    return hydratedGame;
  }
  async function createGame(request: ICreateGameRequest): Promise<IGame> {
    const nowUtc = new Date();
    const rootPosition = request.rootPosition ?? createInitialBoardPosition();
    const initialClockSnapshot = clock.initialiseClockSnapshot(request.timeControl);
    const isLiveGame = !!request.whitePlayer && !!request.blackPlayer;
    const livePath: MovePath | undefined = isLiveGame ? [] : undefined;
    const game: IGame = {
      schemaVersion: 1,
      metadata: createGameMetadata(request.name, nowUtc),
      gameState: isLiveGame ? status.getLiveState(rootPosition.sideToMove) : status.getAnalysisState(rootPosition.sideToMove),
      resultState: ResultState.Ongoing,
      whitePlayer: playerTurn.createPlayerSnapshot(request.whitePlayer),
      blackPlayer: playerTurn.createPlayerSnapshot(request.blackPlayer),
      rootPosition,
      moveTree: MoveHistoryService.createMoveTree(initialClockSnapshot),
      livePath,
      renderedPath: [],
      timeControl: request.timeControl,
      clockSnapshot: isLiveGame ? clock.startClock(initialClockSnapshot, rootPosition.sideToMove, new ClockTimestamp(nowUtc)) : initialClockSnapshot,
      analysis: {
        snapshots: request.analysisEngineProfiles.map((engineProfile) => analysis.createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(rootPosition), nowUtc)),
      },
      gameplayOptions: { allowTakeback: request.allowTakeback, showLiveAnalysisMoves: request.showLiveAnalysisMoves },
    };
    const insertedGame = await hydrateAndInsertGame(game);
    playerTurn.requestPlayerMoveIfNeeded(insertedGame);
    if (insertedGame.analysis.snapshots.length > 0) await analysis.refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  async function startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest): Promise<void> {
    game.metadata.name = request.name ?? game.metadata.name;
    game.whitePlayer = playerTurn.createPlayerSnapshot(request.whitePlayer);
    game.blackPlayer = playerTurn.createPlayerSnapshot(request.blackPlayer);
    game.timeControl = request.timeControl;
    game.gameplayOptions = { showLiveAnalysisMoves: request.showLiveAnalysisMoves, allowTakeback: request.allowTakeback };
    const renderedPosition = position.getRenderedPosition(game);
    game.analysis.snapshots = request.analysisEngineProfiles.map((engineProfile) => analysis.createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(renderedPosition), new Date()));
    game.clockSnapshot = clock.initialiseClockSnapshot(game.timeControl);
    playerTurn.clearPlayerTurnRuntime(game);
    if (game.whitePlayer && game.blackPlayer) startLiveGame(game, renderedPosition);
    else {
      position.setLivePath(game, undefined);
      game.gameState = status.getAnalysisState(renderedPosition.sideToMove);
    }
    touchGame(game);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysis.refreshAnalysisForGame(game);
  }
  function startLiveGame(game: IGame, renderedPosition: ReturnType<GamePositionComposable['getRenderedPosition']>): void {
    position.setLivePath(game, game.renderedPath, { node: position.getRenderedNode(game), position: renderedPosition });
    game.clockSnapshot = clock.startClock(game.clockSnapshot, renderedPosition.sideToMove, new ClockTimestamp());
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.gameState = status.getLiveState(renderedPosition.sideToMove);
  }
  /** Takes ownership of `game`, hydrates it in place, and inserts that same object into the workspace. */
  async function insertGame(game: IGame): Promise<IGame> {
    const insertedGame = await hydrateAndInsertGame(game);
    const settings = await UserSettingService.getSettingsOrDefault();
    if (settings.analysis.resumeLiveAnalysisAfterRestore && insertedGame.analysis.snapshots.length > 0) await analysis.refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  /** Observes a live workspace game; mutation remains owned by explicit store actions. */
  function getGame(gameId: string): ReadonlyGame | undefined {
    return games.value.find((game) => game.metadata.id === gameId);
  }
  /** Observes the live workspace collection without creating defensive snapshots. */
  function listGames(): readonly ReadonlyGame[] {
    return games.value;
  }
  return { createGame, startGameFromSetup, insertGame, getGame, listGames };
}
export type GameWorkspaceComposable = ReturnType<typeof useGameWorkspace>;
