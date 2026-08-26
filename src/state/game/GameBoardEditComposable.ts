import { GameState, ResultState, type BoardId, type IBoardPosition, type IChessPiece, type IGame } from '@/contracts';
import { MoveApplicationService } from '@/domain';
import { createInitialBoardPosition } from '@/utility/chess';
import type { GameAnalysisComposable } from './GameAnalysisComposable';
import type { GameMoveComposable } from './GameMoveComposable';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';

interface IGameBoardEditDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  analysis: GameAnalysisComposable;
  move: GameMoveComposable;
  // game persistent data touched event (internally updating update time)
  touchGame: (game: IGame) => void;
}

export function useGameBoardEdit(dependency: IGameBoardEditDependency) {
  const { position, status, analysis, move, touchGame } = dependency;
  function assertBoardEditState(game: IGame): void {
    if (game.gameState !== GameState.BoardEdit) throw new Error('Board manipulation is only allowed while board edit mode is active.');
  }
  /**
   * Board edits mutate in place. The first effective edit to a non-root rendered position promotes it
   * to the new board root and clears prior history; later edits target that root directly.
   */
  function applyEdit(game: IGame, edit: (boardPosition: IBoardPosition) => boolean): void {
    const renderedPosition = game.renderedPath.length === 0 ? game.rootPosition : position.getRenderedPosition(game);
    if (!edit(renderedPosition)) return; // nothing changed, so prior history survives
    if (renderedPosition !== game.rootPosition) {
      move.replaceWithAnalysisRoot(game, renderedPosition, GameState.BoardEdit);
      return;
    }
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    position.invalidateRenderedPosition(game);
    touchGame(game);
  }
  function enterBoardEdit(game: IGame): void {
    status.assertNotPausedForAction(game, 'Board edit entry');
    if (game.gameState === GameState.BoardEdit) {
      game.gameState = status.getAnalysisState(game.rootPosition.sideToMove);
      touchGame(game);
      void analysis.refreshAnalysisForGame(game);
      return;
    }
    if (status.isLiveState(game.gameState) || status.isPausedState(game.gameState) || status.isAnyLiveAnalysisState(game.gameState)) return;
    void analysis.stopAnalysis(game);
    game.gameState = GameState.BoardEdit;
    touchGame(game);
  }
  function applyBoardEdit(game: IGame, rootPosition: IBoardPosition): void {
    assertBoardEditState(game);
    move.replaceWithAnalysisRoot(game, rootPosition, GameState.BoardEdit);
  }
  function clearBoard(game: IGame): void {
    assertBoardEditState(game);
    applyEdit(game, (boardPosition) => MoveApplicationService.clearBoard(boardPosition));
  }
  function deleteChessPiece(game: IGame, boardId: BoardId): void {
    assertBoardEditState(game);
    applyEdit(game, (boardPosition) => MoveApplicationService.deletePiece(boardPosition, boardId));
  }
  function moveChessPiece(game: IGame, from: BoardId, to: BoardId): void {
    assertBoardEditState(game);
    applyEdit(game, (boardPosition) => MoveApplicationService.movePiece(boardPosition, from, to));
  }
  function resetBoardToStartPosition(game: IGame): void {
    assertBoardEditState(game);
    move.replaceWithAnalysisRoot(game, createInitialBoardPosition(), GameState.BoardEdit);
  }
  function toggleChessPiece(game: IGame, boardId: BoardId, piece: IChessPiece): void {
    assertBoardEditState(game);
    applyEdit(game, (boardPosition) => MoveApplicationService.togglePiece(boardPosition, boardId, piece));
  }
  return {
    enterBoardEdit,
    applyBoardEdit,
    clearBoard,
    deleteChessPiece,
    moveChessPiece,
    resetBoardToStartPosition,
    toggleChessPiece,
  };
}
export type GameBoardEditComposable = ReturnType<typeof useGameBoardEdit>;
