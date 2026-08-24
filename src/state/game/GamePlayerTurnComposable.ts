import {
  GameState,
  PlayerActivityState,
  PlayerColour,
  PlayerType,
  ResultState,
  type IAssignedEngine,
  type IBoardPosition,
  type IEnginePlayer,
  type IGame,
  type IGameRuntime,
  type IMove,
  type IPlayer,
} from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { EngineRuntimeService } from '@/domain';
import { Deferred } from '@/utility/async/Deferred';
import { isMoveLegal } from '@/utility/chess';
import { logHandledError } from '@/utility/errors';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGamePlayerTurnDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  touchGame: (game: IGame) => void;
  commitLiveMove: (game: IGame, move: IMove, engine?: IAssignedEngine) => void;
  replaceWithAnalysisRoot: (game: IGame, boardRoot: IBoardPosition, nextState: GameState) => void;
  refreshRuntimeRegistrations: (game: IGame) => void;
}

export function useGamePlayerTurn(dependency: IGamePlayerTurnDependency) {
  const { position, status, touchGame, commitLiveMove, replaceWithAnalysisRoot, refreshRuntimeRegistrations } = dependency;
  function clonePlayer(player?: IPlayer): IPlayer | undefined {
    if (!player) return;
    const clonedPlayer = structuredClone(player);
    clonedPlayer.$ = { activityState: PlayerActivityState.Active };
    return clonedPlayer;
  }
  function normalisePlayers(game: IGame): void {
    if (game.whitePlayer) game.whitePlayer.$ = { activityState: PlayerActivityState.Active };
    if (game.blackPlayer) game.blackPlayer.$ = { activityState: PlayerActivityState.Active };
  }
  function getSideToMovePlayer(game: IGame, positionColour: PlayerColour): IPlayer | undefined {
    return positionColour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
  }
  function isEnginePlayer(player?: IPlayer): player is IEnginePlayer {
    return player?.type === PlayerType.Engine;
  }
  function clearDeferredPlayerMove(runtime: IGameRuntime): void {
    runtime.deferredPlayerMove = undefined;
  }
  function clearPendingPlayerTurn(runtime: IGameRuntime): void {
    runtime.pendingPlayerTurnPromise?.reject(new Aborted());
    runtime.pendingPlayerTurnPromise = undefined;
    runtime.pendingPlayerTurnHandlePromise = undefined;
  }
  function clearPlayerTurnRuntime(game: IGame): void {
    const runtime = position.requireGameRuntime(game);
    clearDeferredPlayerMove(runtime);
    clearPendingPlayerTurn(runtime);
  }
  async function flushDeferredPlayerMove(game: IGame): Promise<void> {
    const runtime = position.requireGameRuntime(game);
    const deferredPlayerMove = runtime.deferredPlayerMove;
    if (!deferredPlayerMove) return;
    runtime.deferredPlayerMove = undefined;
    if (!status.isLiveTurnReadyForMove(game)) return;
    const player = getSideToMovePlayer(game, deferredPlayerMove.movingColour);
    if (isMoveLegal(position.getLivePosition(game), deferredPlayerMove)) commitLiveMove(game, deferredPlayerMove, isEnginePlayer(player) ? player.assignedEngine : undefined);
    else requestPlayerMoveIfNeeded(game);
  }
  function startPonderingIfAvailable(game: IGame, engine: IAssignedEngine | undefined, ponderMove: IMove | undefined): void {
    if (!engine || !ponderMove || game.resultState !== ResultState.Ongoing || game.livePath === undefined) return;
    position.getLivePosition(game);
    void EngineRuntimeService.startPondering(engine, game, ponderMove).catch((error) => logHandledError('GameStore', 'startPondering', error));
  }
  function requestPlayerMove(game: IGame): void {
    async function requestEngineMove(engine: IAssignedEngine): Promise<IMove> {
      await EngineRuntimeService.ensureReady(engine);
      await EngineRuntimeService.startPlayerTurn(engine, game);
      return await EngineRuntimeService.awaitPlayerTurnMove(engine);
    }
    async function playerMoveHandler(pendingPlayerMove: Promise<IMove>, engine?: IAssignedEngine): Promise<void> {
      const runtime = position.requireGameRuntime(game);
      let move: IMove;
      try {
        move = await pendingPlayerMove;
      } catch (error) {
        if (!(error instanceof Aborted)) {
          logHandledError('GameStore', '_playerMoveHandler', error);
          setTimeout(() => requestPlayerMove(game), 500);
        }
        return;
      } finally {
        runtime.pendingPlayerTurnPromise = undefined;
        runtime.pendingPlayerTurnHandlePromise = undefined;
      }
      if (status.isPausedState(game.gameState)) runtime.deferredPlayerMove = move;
      else commitLiveMove(game, move, engine);
    }
    const player = getSideToMovePlayer(game, position.getLivePosition(game).sideToMove);
    const runtime = position.requireGameRuntime(game);
    const pendingPlayerMove = isEnginePlayer(player)
      ? new Deferred<IMove>(requestEngineMove(player.assignedEngine))
      : new Deferred<IMove>();
    runtime.pendingPlayerTurnPromise = pendingPlayerMove;
    runtime.pendingPlayerTurnHandlePromise = playerMoveHandler(pendingPlayerMove, isEnginePlayer(player) ? player.assignedEngine : undefined);
  }
  function requestPlayerMoveIfNeeded(game: IGame): void {
    if (!status.isOngoingLiveGame(game) || !status.isLiveState(game.gameState) || !position.pathsEqual(game.renderedPath, game.livePath)) return;
    if (position.requireGameRuntime(game).pendingPlayerTurnPromise) return;
    requestPlayerMove(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void> {
    const selectedPosition = position.getRenderedPosition(game);
    const liveColour = game.livePath ? position.getLivePosition(game).sideToMove : undefined;
    if (colour === PlayerColour.White) game.whitePlayer = clonePlayer(player);
    else game.blackPlayer = clonePlayer(player);
    clearPlayerTurnRuntime(game);
    if (!game.whitePlayer || !game.blackPlayer) {
      replaceWithAnalysisRoot(game, selectedPosition, status.getAnalysisState(selectedPosition.sideToMove));
      position.requireGameRuntime(game).renderedPosition = selectedPosition;
    } else {
      if (status.isPausedLiveState(game.gameState)) game.gameState = status.getPausedState(selectedPosition.sideToMove);
      else if (status.isLiveState(game.gameState)) game.gameState = status.getLiveState(selectedPosition.sideToMove);
      else if (status.isAnyLiveAnalysisState(game.gameState) && liveColour) game.gameState = status.getLiveAnalysisState(liveColour, selectedPosition.sideToMove, status.isPausedLiveAnalysisState(game.gameState));
      else if (game.livePath && game.resultState === ResultState.Ongoing) game.gameState = status.getLiveState(selectedPosition.sideToMove);
      touchGame(game);
    }
    refreshRuntimeRegistrations(game);
    requestPlayerMoveIfNeeded(game);
  }
  return {
    clonePlayer,
    normalisePlayers,
    getSideToMovePlayer,
    isEnginePlayer,
    clearPlayerTurnRuntime,
    flushDeferredPlayerMove,
    startPonderingIfAvailable,
    requestPlayerMoveIfNeeded,
    reassignPlayer,
  };
}
export type GamePlayerTurnComposable = ReturnType<typeof useGamePlayerTurn>;
