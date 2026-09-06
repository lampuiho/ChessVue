import {
  GameState,
  PlayerActivityState,
  PlayerColour,
  PlayerType,
  ResultState,
  playerSchema,
  type IAssignedEngine,
  type IBoardPosition,
  type IEnginePlayer,
  type IGame,
  type IGameRuntime,
  type IMove,
  type IPlayer,
} from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { EngineRuntimeService, TimeControlService } from '@/domain';
import { Deferred } from '@/utility/async/Deferred';
import { ClockTimestamp } from '@/utility/date';
import { logHandledError } from '@/utility/errors';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGamePlayerTurnDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  touchGame: (game: IGame) => void;
  commitLiveMove: (game: IGame, move: IMove) => void;
  replaceWithAnalysisRoot: (game: IGame, rootPosition: IBoardPosition, nextState: GameState) => void;
  refreshRuntimeRegistrations: (game: IGame) => void;
}

export function useGamePlayerTurn(dependency: IGamePlayerTurnDependency) {
  const { position, status, touchGame, commitLiveMove, refreshRuntimeRegistrations } = dependency;
  /** Creates the persisted per-game player snapshot and discards runtime owned by the input record. */
  function createPlayerSnapshot(player?: IPlayer): IPlayer | undefined {
    if (!player) return;
    const playerSnapshot: IPlayer = playerSchema.parse(player);
    playerSnapshot.$ = { activityState: PlayerActivityState.Active };
    return playerSnapshot;
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
  async function clearPendingPlayerTurn(runtime: IGameRuntime): Promise<void> {
    const pendingPlayerTurn = runtime.pendingPlayerTurnPromise;
    const pendingPlayerTurnHandle = runtime.pendingPlayerTurnHandlePromise;
    const abortController = runtime.pendingPlayerTurnAbortController;
    if (!pendingPlayerTurn || !pendingPlayerTurnHandle || !abortController) return;
    abortController.abort(new Aborted());
    pendingPlayerTurn.reject(abortController.signal.reason);
    await pendingPlayerTurnHandle;
  }
  async function clearPlayerTurnRuntime(game: IGame): Promise<void> {
    const runtime = position.requireGameRuntime(game);
    clearDeferredPlayerMove(runtime);
    await clearPendingPlayerTurn(runtime);
  }
  async function flushDeferredPlayerMove(game: IGame): Promise<void> {
    const runtime = position.requireGameRuntime(game);
    const deferredPlayerMove = runtime.deferredPlayerMove;
    if (!deferredPlayerMove) return;
    runtime.deferredPlayerMove = undefined;
    if (!status.isLiveTurnReadyForMove(game)) return;
    commitLiveMove(game, deferredPlayerMove);
  }
  async function attemptPlayerMove(game: IGame, move: IMove): Promise<void> {
    const runtime = position.requireGameRuntime(game);
    const pendingPlayerMove = runtime.pendingPlayerTurnPromise;
    const pendingPlayerTurnHandle = runtime.pendingPlayerTurnHandlePromise;
    if (!pendingPlayerMove || !pendingPlayerTurnHandle) throw new ReferenceError(`turn started to allow make move for ${move.movingColour} but move request was not made`);
    pendingPlayerMove.resolve(move);
    await pendingPlayerTurnHandle;
  }
  function requestPlayerMove(game: IGame): void {
    async function requestEngineMove(engine: IAssignedEngine): Promise<void> {
      await EngineRuntimeService.ensureReady(engine, abortController.signal);
      await EngineRuntimeService.startPlayerTurn(engine, game, async (move) => {
        if (position.requireGameRuntime(game).pendingPlayerTurnPromise !== pendingPlayerMove) return;
        await attemptPlayerMove(game, move);
      }, abortController.signal);
    }
    async function playerMoveHandler(pendingPlayerMove: Promise<IMove>): Promise<void> {
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
        //if (runtime.pendingPlayerTurnPromise === pendingPlayerMove) guard uneccessary because only 1 player turn can start. old promise must be aborted / completed before another turn can start
          runtime.pendingPlayerTurnPromise = undefined;
          runtime.pendingPlayerTurnHandlePromise = undefined;
          runtime.pendingPlayerTurnAbortController = undefined;
      }
      if (status.isPausedState(game.gameState)) runtime.deferredPlayerMove = move;
      else commitLiveMove(game, move);
    }
    const player = getSideToMovePlayer(game, position.getLivePosition(game).sideToMove);
    const runtime = position.requireGameRuntime(game);
    const abortController = new AbortController();
    const pendingPlayerMove = new Deferred<IMove>();
    const pendingPlayerTurnHandle = playerMoveHandler(pendingPlayerMove);
    runtime.pendingPlayerTurnPromise = pendingPlayerMove;
    runtime.pendingPlayerTurnHandlePromise = pendingPlayerTurnHandle;
    runtime.pendingPlayerTurnAbortController = abortController;
    if (isEnginePlayer(player)) void requestEngineMove(player.assignedEngine).catch((error) => pendingPlayerMove.reject(error));
  }
  function requestPlayerMoveIfNeeded(game: IGame): void {
    if (!status.isOngoingLiveGame(game) || !status.isLiveState(game.gameState) || !position.pathsEqual(game.renderedPath, game.livePath)) return;
    if (position.requireGameRuntime(game).pendingPlayerTurnPromise) return;
    requestPlayerMove(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer): Promise<void> {
    const nextPlayer = createPlayerSnapshot(player);
    const previousPlayer = colour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
    await clearPlayerTurnRuntime(game);
    if (isEnginePlayer(previousPlayer)) await EngineRuntimeService.stopEngine(previousPlayer.assignedEngine);
    const selectedPosition = position.getRenderedPosition(game);
    const liveColour = game.livePath ? position.getLivePosition(game).sideToMove : undefined;
    if (colour === PlayerColour.White) game.whitePlayer = nextPlayer;
    else game.blackPlayer = nextPlayer;
    if (!game.whitePlayer || !game.blackPlayer) {
      game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, new ClockTimestamp());
      position.setLivePath(game, undefined);
      game.drawOfferState = undefined;
      game.gameState = status.getAnalysisState(selectedPosition.sideToMove);
      touchGame(game);
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
    createPlayerSnapshot,
    normalisePlayers,
    getSideToMovePlayer,
    isEnginePlayer,
    clearPlayerTurnRuntime,
    flushDeferredPlayerMove,
    attemptPlayerMove,
    requestPlayerMoveIfNeeded,
    reassignPlayer,
  };
}
export type GamePlayerTurnComposable = ReturnType<typeof useGamePlayerTurn>;
