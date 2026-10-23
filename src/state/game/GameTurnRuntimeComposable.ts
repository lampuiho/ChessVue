import type { IGame, IGameRuntime } from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import type { GamePositionComposable } from './GamePositionComposable';

interface IGameTurnRuntimeDependency {
  position: GamePositionComposable;
}
export function useGameTurnRuntime({ position }: IGameTurnRuntimeDependency) {
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
  return { clearPlayerTurnRuntime };
}
export type GameTurnRuntimeComposable = ReturnType<typeof useGameTurnRuntime>;
