import { shallowReactive } from 'vue';
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
import { genLegalMovesForPiece, toDetailedMove } from '@/utility/chess';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGamePlayerTurnDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  touchGame: (game: IGame) => void;
  commitLiveMove: (game: IGame, move: IMove) => void;
  replaceWithAnalysisRoot: (game: IGame, rootPosition: IBoardPosition, nextState: GameState) => void;
  refreshRuntimeRegistrations: (game: IGame) => void;
  clearPremoves: (game: IGame) => void;
  publishRuntime: () => void;
}

export function useGamePlayerTurn(dependency: IGamePlayerTurnDependency) {
  const { position, status, touchGame, commitLiveMove, refreshRuntimeRegistrations, clearPremoves, publishRuntime } = dependency;
  /** Creates the persisted per-game player snapshot and discards runtime owned by the input record. */
  function createPlayerSnapshot(player?: IPlayer): IPlayer | undefined {
    if (!player) return;
    const playerSnapshot: IPlayer = playerSchema.parse(player);
    _initialisePlayerRuntime(playerSnapshot);
    return playerSnapshot;
  }
  function normalisePlayers(game: IGame) {
    if (game.whitePlayer) _initialisePlayerRuntime(game.whitePlayer);
    if (game.blackPlayer) _initialisePlayerRuntime(game.blackPlayer);
  }
  function _initialisePlayerRuntime(player: IPlayer) {
    player.$ = { activityState: PlayerActivityState.Active };
    if (isEnginePlayer(player)) player.assignedEngine.$ = shallowReactive(EngineRuntimeService.ensureRuntime(player.assignedEngine));
  }
  function getSideToMovePlayer(game: IGame, positionColour: PlayerColour): IPlayer | undefined {
    return positionColour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
  }
  function isEnginePlayer(player?: IPlayer): player is IEnginePlayer {
    return player?.type === PlayerType.Engine;
  }
  function _clearDeferredPlayerMove(runtime: IGameRuntime) {
    runtime.deferredPlayerMove = undefined;
  }
  async function _clearPendingPlayerTurn(runtime: IGameRuntime) {
    const pendingPlayerTurn = runtime.pendingPlayerTurnPromise;
    const pendingPlayerTurnHandle = runtime.pendingPlayerTurnHandlePromise;
    const abortController = runtime.pendingPlayerTurnAbortController;
    if (!pendingPlayerTurn || !pendingPlayerTurnHandle || !abortController) return;
    abortController.abort(new Aborted());
    pendingPlayerTurn.reject(abortController.signal.reason);
    await pendingPlayerTurnHandle;
  }
  async function clearPlayerTurnRuntime(game: IGame) {
    const runtime = position.requireGameRuntime(game);
    _clearDeferredPlayerMove(runtime);
    await _clearPendingPlayerTurn(runtime);
  }
  async function flushDeferredPlayerMove(game: IGame) {
    const runtime = position.requireGameRuntime(game);
    const deferredPlayerMove = runtime.deferredPlayerMove;
    if (!deferredPlayerMove) return;
    runtime.deferredPlayerMove = undefined;
    if (!status.isLiveTurnReadyForMove(game)) return;
    commitLiveMove(game, deferredPlayerMove);
  }
  async function attemptPlayerMove(game: IGame, move: IMove) {
    const runtime = position.requireGameRuntime(game);
    const pendingPlayerMove = runtime.pendingPlayerTurnPromise;
    const pendingPlayerTurnHandle = runtime.pendingPlayerTurnHandlePromise;
    if (!pendingPlayerMove || !pendingPlayerTurnHandle) throw new ReferenceError(`turn started to allow make move for ${move.movingColour} but move request was not made`);
    pendingPlayerMove.resolve(move);
    await pendingPlayerTurnHandle;
  }
  async function _tryPremove(game: IGame) {
    const runtime = position.requireGameRuntime(game);
    const queue = runtime.premoveQueue;
    if (!queue) return;
    const head = queue.moves[0]!;
    const livePosition = position.getLivePosition(game);
    const candidate = genLegalMovesForPiece(livePosition, head.from, position.getLiveNode(game).move)
      .find((move) => move.to === head.to && move.promotionPiece === head.promotionPiece);
    if (!candidate) { clearPremoves(game); return; }
    const move = toDetailedMove(livePosition, candidate);
    queue.moves.shift();
    if (!queue.moves.length) runtime.premoveQueue = undefined;
    await attemptPlayerMove(game, move);
    if (runtime.deferredPlayerMove === move) publishRuntime();
  }
  function _requestPlayerMove(game: IGame) {
    async function _requestEngineMove(engine: IAssignedEngine) {
      await EngineRuntimeService.ensureReady(engine, abortController.signal);
      await EngineRuntimeService.startPlayerTurn(engine, game, async (move) => {
        if (abortController.signal.aborted) return;
        await attemptPlayerMove(game, move);
      }, abortController.signal);
    }
    async function _playerMoveHandler(pendingPlayerMove: Promise<IMove>) {
      const runtime = position.requireGameRuntime(game);
      let move: IMove;
      try {
        move = await pendingPlayerMove;
      } catch (error) {
        if (!(error instanceof Aborted)) {
          logHandledError('GameStore', '_playerMoveHandler', error);
          setTimeout(() => requestPlayerMoveIfNeeded(game), 500);
        }
        return;
      } finally {
        runtime.pendingPlayerTurnPromise = undefined;
        runtime.pendingPlayerTurnHandlePromise = undefined;
        runtime.pendingPlayerTurnAbortController = undefined;
      }
      if (status.isPausedState(game.gameState)) runtime.deferredPlayerMove = move;
      else commitLiveMove(game, move);
    }
    const player = getSideToMovePlayer(game, position.getLivePosition(game).sideToMove);
    const runtime = position.requireGameRuntime(game);
    if (runtime.pendingPlayerTurnPromise) throw new Error('The current player turn must settle before another starts.');
    const abortController = new AbortController();
    const pendingPlayerMove = new Deferred<IMove>();
    const pendingPlayerTurnHandle = _playerMoveHandler(pendingPlayerMove);
    runtime.pendingPlayerTurnPromise = pendingPlayerMove;
    runtime.pendingPlayerTurnHandlePromise = pendingPlayerTurnHandle;
    runtime.pendingPlayerTurnAbortController = abortController;
    if (isEnginePlayer(player)) void _requestEngineMove(player.assignedEngine).catch((error) => pendingPlayerMove.reject(error));
    else if (player?.type === PlayerType.Local) void _tryPremove(game).catch((error) => logHandledError('GameStore', '_tryPremove', error));
  }
  function requestPlayerMoveIfNeeded(game: IGame) {
    if (!status.isLiveTurnReadyForMove(game)) return;
    if (position.requireGameRuntime(game).pendingPlayerTurnPromise) return;
    _requestPlayerMove(game);
  }
  async function reassignPlayer(game: IGame, colour: PlayerColour, player?: IPlayer) {
    if (game.gameState === GameState.BoardEdit) throw new Error('Player reassignment is not allowed while editing the board.');
    const nextPlayer = createPlayerSnapshot(player);
    const previousPlayer = colour === PlayerColour.White ? game.whitePlayer : game.blackPlayer;
    if (JSON.stringify(playerSchema.optional().parse(previousPlayer)) === JSON.stringify(playerSchema.optional().parse(nextPlayer))) return;
    await clearPlayerTurnRuntime(game);
    if (isEnginePlayer(previousPlayer)) await EngineRuntimeService.stopEngine(previousPlayer.assignedEngine);
    const selectedPosition = position.getRenderedPosition(game);
    const liveColour = game.livePath ? position.getLivePosition(game).sideToMove : undefined;
    clearPremoves(game);
    if (colour === PlayerColour.White) game.whitePlayer = nextPlayer;
    else game.blackPlayer = nextPlayer;
    if (!game.whitePlayer || !game.blackPlayer) {
      game.clockSnapshot = TimeControlService.pauseClock(game.clockSnapshot, new ClockTimestamp());
      position.setLivePath(game, undefined);
      game.drawOfferState = undefined;
      game.resultState = ResultState.Ongoing;
      game.resultReason = undefined;
      position.requireGameRuntime(game).pauseReasons = undefined;
      game.gameState = status.getAnalysisState(selectedPosition.sideToMove);
      touchGame(game);
    } else {
      if (status.isPausedLiveState(game.gameState)) game.gameState = status.getPausedState(liveColour ?? selectedPosition.sideToMove);
      else if (status.isLiveState(game.gameState)) game.gameState = status.getLiveState(liveColour ?? selectedPosition.sideToMove);
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
