import { ref } from 'vue';
import {
  ResultState,
  type ICreateGameRequest,
  type IGame,
  type IStartGameFromSetupRequest,
  type MovePath,
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
  function repairDuplicateGameId(game: IGame, existingGameIds: ReadonlySet<string>): IGame {
    if (!existingGameIds.has(game.metadata.id)) return game;
    return {
      ...game,
      metadata: { ...game.metadata, id: crypto.randomUUID(), updatedAt: new RecordTimestamp() },
    };
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
    const hydratedGame = position.hydrateGame(repairDuplicateGameId(game, getExistingGameIds()));
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
      whitePlayer: playerTurn.clonePlayer(request.whitePlayer),
      blackPlayer: playerTurn.clonePlayer(request.blackPlayer),
      rootPosition,
      moveTree: MoveHistoryService.createMoveTree(initialClockSnapshot),
      livePath,
      highlightPath: [],
      timeControl: structuredClone(request.timeControl),
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
    game.whitePlayer = playerTurn.clonePlayer(request.whitePlayer);
    game.blackPlayer = playerTurn.clonePlayer(request.blackPlayer);
    game.timeControl = structuredClone(request.timeControl);
    game.gameplayOptions = { showLiveAnalysisMoves: request.showLiveAnalysisMoves, allowTakeback: request.allowTakeback };
    const renderedPosition = position.getRenderedPosition(game);
    game.analysis.snapshots = request.analysisEngineProfiles.map((engineProfile) => analysis.createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(renderedPosition), new Date()));
    game.clockSnapshot = clock.initialiseClockSnapshot(game.timeControl);
    playerTurn.clearPlayerTurnRuntime(game);
    if (game.whitePlayer && game.blackPlayer) startLiveGame(game, renderedPosition);
    else {
      game.livePath = undefined;
      position.requireGameRuntime(game).livePosition = undefined;
      game.gameState = status.getAnalysisState(renderedPosition.sideToMove);
    }
    position.syncRuntimeNodeCache(game);
    touchGame(game);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysis.refreshAnalysisForGame(game);
  }
  function startLiveGame(game: IGame, renderedPosition: ReturnType<GamePositionComposable['getRenderedPosition']>): void {
    game.livePath = [...game.highlightPath];
    position.requireGameRuntime(game).livePosition = renderedPosition;
    game.clockSnapshot = clock.startClock(game.clockSnapshot, renderedPosition.sideToMove, new ClockTimestamp());
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.gameState = status.getLiveState(renderedPosition.sideToMove);
  }
  async function insertGame(game: IGame): Promise<IGame> {
    const insertedGame = await hydrateAndInsertGame(game);
    const settings = await UserSettingService.getSettingsOrDefault();
    if (settings.analysis.resumeLiveAnalysisAfterRestore && insertedGame.analysis.snapshots.length > 0) await analysis.refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  function getGame(gameId: string): IGame | undefined {
    return games.value.find((game) => game.metadata.id === gameId);
  }
  function listGames(): IGame[] {
    return games.value;
  }
  return { createGame, startGameFromSetup, insertGame, getGame, listGames };
}
export type GameWorkspaceComposable = ReturnType<typeof useGameWorkspace>;
