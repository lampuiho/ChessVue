import { shallowReactive } from 'vue';
import { ResultState, type IGame, type IMoveRaw, type IPlayer } from '@/contracts';
import { MoveApplicationService } from '@/domain';
import { genCandidateMovesForPiece } from '@/utility/chess';
import type { GamePositionComposable } from './GamePositionComposable';

interface IGamePremoveDependency {
  position: GamePositionComposable;
}
export function useGamePremove({ position }: IGamePremoveDependency) {
  function clearPremoves(game: IGame) {
    if (!game.$?.premoveQueue) return;
    game.$.premoveQueue = undefined;
  }
  function appendPremove(game: IGame, player: IPlayer, rawMove: IMoveRaw) {
    const queue = game.$!.premoveQueue ??= { player, moves: shallowReactive<IMoveRaw[]>([]) };
    queue.moves.push(rawMove);
  }
  function revalidatePremoves(game: IGame) {
    const queue = position.requireGameRuntime(game).premoveQueue;
    if (!queue) return;
    if (game.resultState !== ResultState.Ongoing) { clearPremoves(game); return; }
    const preview = MoveApplicationService.genPosition(position.getLivePosition(game), []);
    for (const move of queue.moves) {
      if (preview.board[move.from]?.colour !== queue.player.colour
        || !genCandidateMovesForPiece(preview, move.from).some((candidate) => candidate.to === move.to && candidate.promotionPiece === move.promotionPiece)) {
        clearPremoves(game);
        return;
      }
      position.applyPremoveProjection(preview, move);
    }
  }
  return { clearPremoves, appendPremove, revalidatePremoves };
}
export type GamePremoveComposable = ReturnType<typeof useGamePremove>;
