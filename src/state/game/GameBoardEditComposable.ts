import { GameState, ResultState, type BoardId, type IBoardPosition, type IChessPiece, type IGame } from '@/contracts';
import { MoveApplicationService } from '@/domain';
import { createInitialBoardPosition } from '@/utility/chess';
import type { GameAnalysisComposable } from './GameAnalysisComposable';
import type { GameMoveComposable } from './GameMoveComposable';
import type { GamePositionComposable } from './GamePositionComposable';
import type { GameStatusComposable } from './GameStatusComposable';
import type { GameRecordComposable } from './GameRecordComposable';

interface IGameBoardEditDependency {
  position: GamePositionComposable;
  status: GameStatusComposable;
  analysis: GameAnalysisComposable;
  move: GameMoveComposable;
  record: GameRecordComposable;
}

export function useGameBoardEdit(dependency: IGameBoardEditDependency) {
  const { position, status, analysis, move, record } = dependency;
  function _assertBoardEditState(game: IGame) {
    if (game.gameState !== GameState.BoardEdit) throw new Error('Board manipulation is only allowed while board edit mode is active.');
  }
  /**
   * Board edits mutate in place. The first effective edit to a position with history promotes it
   * to the new board root and clears prior history; later edits target that root directly.
   */
  function _applyEdit(game: IGame, edit: (boardPosition: IBoardPosition) => boolean) {
    const renderedPosition = game.renderedPath.length === 0 ? game.rootPosition : position.getRenderedPosition(game);
    if (!edit(renderedPosition)) return; // nothing changed, so prior history survives
    if (renderedPosition !== game.rootPosition || game.moveTree.root.children.length > 0) {
      move.replaceWithAnalysisRoot(game, renderedPosition, GameState.BoardEdit);
      return;
    }
    game.resultState = ResultState.Ongoing;
    game.resultReason = undefined;
    game.drawOfferState = undefined;
    position.invalidateRenderedPosition(game);
    void analysis.refreshAnalysisForGame(game);
  }
  function enterBoardEdit(game: IGame) {
    status.assertNotPausedForAction(game, 'Board edit entry');
    if (game.livePath) return;
    if (game.gameState === GameState.BoardEdit) {
      game.gameState = status.getAnalysisState(position.getRenderedPosition(game).sideToMove);
      void analysis.refreshAnalysisForGame(game);
      return;
    }
    if (status.isLiveState(game.gameState) || status.isPausedState(game.gameState) || status.isAnyLiveAnalysisState(game.gameState)) return;
    void analysis.stopAnalysis(game);
    game.gameState = GameState.BoardEdit;
    record.timestampGame(game);
  }
  function applyBoardEdit(game: IGame, rootPosition: IBoardPosition) {
    _assertBoardEditState(game);
    move.replaceWithAnalysisRoot(game, rootPosition, GameState.BoardEdit);
  }
  function clearBoard(game: IGame) {
    _assertBoardEditState(game);
    _applyEdit(game, (boardPosition) => MoveApplicationService.clearBoard(boardPosition));
  }
  function deleteChessPiece(game: IGame, boardId: BoardId) {
    _assertBoardEditState(game);
    _applyEdit(game, (boardPosition) => MoveApplicationService.deletePiece(boardPosition, boardId));
  }
  function moveChessPiece(game: IGame, from: BoardId, to: BoardId) {
    _assertBoardEditState(game);
    _applyEdit(game, (boardPosition) => MoveApplicationService.movePiece(boardPosition, from, to));
  }
  function resetBoardToStartPosition(game: IGame) {
    _assertBoardEditState(game);
    move.replaceWithAnalysisRoot(game, createInitialBoardPosition(), GameState.BoardEdit);
  }
  function toggleChessPiece(game: IGame, boardId: BoardId, piece: IChessPiece) {
    _assertBoardEditState(game);
    _applyEdit(game, (boardPosition) => MoveApplicationService.togglePiece(boardPosition, boardId, piece));
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
