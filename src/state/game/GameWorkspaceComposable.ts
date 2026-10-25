import { ref } from 'vue';
import {
  GameState,
  PauseReason,
  PlayerColour,
  PlayerType,
  ResultState,
  type ICreateGameRequest,
  type IGame,
  type IPlayer,
  type IStartGameFromSetupRequest,
  type MovePath,
  type ReadonlyGame,
} from '@/contracts';
import { MoveHistoryService, UserSettingService } from '@/domain';
import { createInitialBoardPosition } from '@/utility/chess';
import { ClockTimestamp, RecordTimestamp } from '@/utility/date';
import type { GameAnalysisComposable } from './GameAnalysisComposable';
import type { GameClockComposable } from './GameClockComposable';
import type { GamePlayerTurnComposable } from './GamePlayerTurnComposable';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';
import type { GameRecordComposable } from './GameRecordComposable';
import type { GamePremoveComposable } from './GamePremoveComposable';

interface IGameWorkspaceDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  clock: GameClockComposable;
  analysis: GameAnalysisComposable;
  playerTurn: GamePlayerTurnComposable;
  record: GameRecordComposable;
  premove: GamePremoveComposable;
}

export function useGameWorkspace(dependency: IGameWorkspaceDependency) {
  const { position, status, clock, analysis, playerTurn, record, premove } = dependency;
  const games = ref<IGame[]>([]);
  function _createGameMetadata(name: string, nowUtc: Date) {
    return {
      id: crypto.randomUUID(),
      name,
      createdAt: new RecordTimestamp(nowUtc),
      updatedAt: new RecordTimestamp(nowUtc),
    };
  }
  /** Insertion transfers ownership; duplicate repair mutates that supplied game before it enters the store. */
  // this is wrong. the game should never be cloned silently. when I open the same game saved at different point
  // I expect the game to just revert to that state
  function _repairDuplicateGameId(game: IGame, existingGameIds: ReadonlySet<string>) {
    if (!existingGameIds.has(game.metadata.id)) return;
    game.metadata.id = crypto.randomUUID();
    game.metadata.updatedAt = new RecordTimestamp();
  }
  function _getGameIndex(gameId: string): number {
    return games.value.findIndex((game) => game.metadata.id === gameId);
  }
  function _getExistingGameIds(excludedGameId?: string): Set<string> {
    return new Set(games.value.filter((game) => game.metadata.id !== excludedGameId).map((game) => game.metadata.id));
  }
  function _replaceGame(game: IGame) {
    const gameIndex = _getGameIndex(game.metadata.id);
    if (gameIndex >= 0) games.value.splice(gameIndex, 1, game);
    else games.value.push(game);
    return games.value[gameIndex >= 0 ? gameIndex : games.value.length - 1]!;
  }
  async function _hydrateAndInsertGame(game: IGame): Promise<IGame> {
    _repairDuplicateGameId(game, _getExistingGameIds());
    const hydratedGame = position.hydrateGame(game);
    if (status.isPausedState(hydratedGame.gameState)) {
      // Saved states omit runtime owners; require an explicit resume after restore.
      hydratedGame.$!.pauseReasons = [PauseReason.Manual];
    }
    playerTurn.normalisePlayers(hydratedGame);
    const insertedGame = _replaceGame(hydratedGame);
    clock.refreshRuntimeRegistrations(insertedGame);
    return insertedGame;
  }
  function _assignPlayer(player: IPlayer | undefined, colour: PlayerColour, participant: number, randomised: boolean) {
    if (!player) return;
    const displayName = randomised && player.type === PlayerType.Local && (player.displayName === 'White' || player.displayName === 'Black') ? `Player ${participant}` : player.displayName;
    return playerTurn.createPlayerSnapshot({ ...player, colour, displayName });
  }
  function _createPlayers(request: Pick<ICreateGameRequest, 'whitePlayer' | 'blackPlayer' | 'randomiseColours'>) {
    const randomised = !!request.randomiseColours && !!request.whitePlayer && !!request.blackPlayer;
    const swap = randomised && Math.random() < 0.5;
    return {
      whitePlayer: _assignPlayer(swap ? request.blackPlayer : request.whitePlayer, PlayerColour.White, swap ? 2 : 1, randomised),
      blackPlayer: _assignPlayer(swap ? request.whitePlayer : request.blackPlayer, PlayerColour.Black, swap ? 1 : 2, randomised),
    };
  }
  async function createGame(request: ICreateGameRequest): Promise<IGame> {
    const nowUtc = new Date();
    const rootPosition = request.rootPosition ?? createInitialBoardPosition();
    const initialClockSnapshot = clock.initialiseClockSnapshot(request.timeControl);
    const isLiveGame = !!request.whitePlayer && !!request.blackPlayer;
    const livePath: MovePath | undefined = isLiveGame ? [] : undefined;
    const game: IGame = {
      schemaVersion: 1,
      metadata: _createGameMetadata(request.name, nowUtc),
      gameState: isLiveGame ? status.getLiveState(rootPosition.sideToMove) : status.getAnalysisState(rootPosition.sideToMove),
      resultState: ResultState.Ongoing,
      ..._createPlayers(request),
      rootPosition,
      moveTree: MoveHistoryService.createMoveTree(initialClockSnapshot),
      livePath,
      renderedPath: [],
      timeControl: request.timeControl,
      clockSnapshot: isLiveGame ? clock.startClock(initialClockSnapshot, rootPosition.sideToMove, new ClockTimestamp(nowUtc)) : initialClockSnapshot,
      analysis: {
        seats: request.analysisEngineProfiles.map((engineProfile) => analysis.createAnalysisSeat(engineProfile, nowUtc)),
      },
      gameplayOptions: { allowTakeback: request.allowTakeback, showLiveAnalysisMoves: request.showLiveAnalysisMoves },
    };
    const insertedGame = await _hydrateAndInsertGame(game);
    playerTurn.requestPlayerMoveIfNeeded(insertedGame);
    if (insertedGame.analysis.seats.length > 0) await analysis.refreshAnalysisForGame(insertedGame);
    return insertedGame;
  }
  async function startGameFromSetup(game: IGame, request: IStartGameFromSetupRequest) {
    const analysisCleanup = analysis.disposeAnalysisForGame(game);
    await playerTurn.clearPlayerTurnRuntime(game);
    await analysisCleanup;
    premove.clearPremoves(game);
    game.metadata.name = request.name ?? game.metadata.name;
    Object.assign(game, _createPlayers(request));
    game.timeControl = request.timeControl;
    game.gameplayOptions = { showLiveAnalysisMoves: request.showLiveAnalysisMoves, allowTakeback: request.allowTakeback };
    const renderedPosition = position.getRenderedPosition(game);
    game.analysis.seats = request.analysisEngineProfiles.map((engineProfile) => analysis.createAnalysisSeat(engineProfile, new Date()));
    game.clockSnapshot = clock.initialiseClockSnapshot(game.timeControl);
    if (game.whitePlayer && game.blackPlayer) _startLiveGame(game, renderedPosition);
    else {
      position.setLivePath(game, undefined);
      game.gameState = status.getAnalysisState(renderedPosition.sideToMove);
    }
    record.timestampGame(game);
    clock.refreshRuntimeRegistrations(game);
    playerTurn.requestPlayerMoveIfNeeded(game);
    await analysis.refreshAnalysisForGame(game);
  }
  function _startLiveGame(game: IGame, renderedPosition: ReturnType<GamePositionComposable['getRenderedPosition']>) {
    position.setLivePath(game, game.renderedPath, { node: position.getRenderedNode(game), position: renderedPosition });
    game.clockSnapshot = clock.startClock(game.clockSnapshot, renderedPosition.sideToMove, new ClockTimestamp());
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.gameState = status.getLiveState(renderedPosition.sideToMove);
  }
  /** Takes ownership of `game` in place and returns the workspace's canonical reactive game. */
  async function insertGame(game: IGame): Promise<IGame> {
    const insertedGame = await _hydrateAndInsertGame(game);
    playerTurn.requestPlayerMoveIfNeeded(insertedGame);
    const settings = await UserSettingService.getSettingsOrDefault();
    if (settings.analysis.resumeLiveAnalysisAfterRestore && insertedGame.gameState !== GameState.BoardEdit && insertedGame.analysis.seats.length > 0) await analysis.refreshAnalysisForGame(insertedGame);
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
