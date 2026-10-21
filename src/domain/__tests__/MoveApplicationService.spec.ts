import { describe, expect, it } from 'vitest';

import { MoveKind, PieceKind, PlayerColour, type IBoardPosition, type IMove } from '@/contracts';
import { MoveApplicationService } from '..';
import { createInitialBoardPosition } from '@/utility/chess';

const _boardId = (file: number, rank: number) => file + (rank * 8);

const e2e4: IMove = {
  from: _boardId(4, 1),
  to: _boardId(4, 3),
  kind: MoveKind.Normal,
  movingColour: PlayerColour.White,
  movingPiece: PieceKind.Pawn,
};
const e7e5: IMove = {
  from: _boardId(4, 6),
  to: _boardId(4, 4),
  kind: MoveKind.Normal,
  movingColour: PlayerColour.Black,
  movingPiece: PieceKind.Pawn,
};

function _occupiedBoardIds(position: IBoardPosition): number[] {
  return position.board.reduce<number[]>((ids, piece, id) => piece === undefined ? ids : [...ids, id], []);
}

describe('MoveApplicationService', () => {
  describe('applyMove', () => {
    it('mutates the supplied position and returns the same object', () => {
      const position = createInitialBoardPosition();

      const nextPosition = MoveApplicationService.applyMove(position, e2e4);

      expect(nextPosition).toBe(position);
      expect(position.board[e2e4.from]).toBeUndefined();
      expect(position.board[e2e4.to]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White });
      expect(position.sideToMove).toBe(PlayerColour.Black);
    });
    it('drops the runtime metadata the transition invalidates', () => {
      const position = createInitialBoardPosition();
      expect(position.$?.isStandardInitialPosition).toBe(true);

      MoveApplicationService.applyMove(position, e2e4);

      expect(position.$?.isStandardInitialPosition).toBeUndefined();
    });
  });

  describe('genPosition', () => {
    it('leaves the supplied root position untouched', () => {
      const rootPosition = createInitialBoardPosition();
      const occupiedBefore = _occupiedBoardIds(rootPosition);
      const movingPawn = rootPosition.board[e2e4.from];

      const generated = MoveApplicationService.genPosition(rootPosition, [e2e4, e7e5]);

      expect(generated).not.toBe(rootPosition);
      expect(generated.board[e2e4.to]).toBe(movingPawn);
      expect(_occupiedBoardIds(rootPosition)).toEqual(occupiedBefore);
      expect(rootPosition.sideToMove).toBe(PlayerColour.White);
    });
    it('matches applying the same moves step by step', () => {
      const generated = MoveApplicationService.genPosition(createInitialBoardPosition(), [e2e4, e7e5]);
      const stepped = createInitialBoardPosition();
      MoveApplicationService.applyMove(stepped, e2e4);
      MoveApplicationService.applyMove(stepped, e7e5);

      expect(_occupiedBoardIds(generated)).toEqual(_occupiedBoardIds(stepped));
      expect(generated.sideToMove).toBe(stepped.sideToMove);
      expect(generated.fullMoveNumber).toBe(stepped.fullMoveNumber);
    });
    it('returns a copy of the root position when there are no moves', () => {
      const rootPosition = createInitialBoardPosition();

      const generated = MoveApplicationService.genPosition(rootPosition, []);

      expect(generated).not.toBe(rootPosition);
      expect(_occupiedBoardIds(generated)).toEqual(_occupiedBoardIds(rootPosition));
    });
  });

  describe('board edits', () => {
    it('clears every occupied square and reports whether anything changed', () => {
      const position = createInitialBoardPosition();

      expect(MoveApplicationService.clearBoard(position)).toBe(true);
      expect(position.board.every((piece) => piece === undefined)).toBe(true);
      expect(position.$).toBeUndefined();
      expect(MoveApplicationService.clearBoard(position)).toBe(false);
    });
    it('deletes an occupied square and no-ops on an empty one', () => {
      const position = createInitialBoardPosition();

      expect(MoveApplicationService.deletePiece(position, _boardId(4, 1))).toBe(true);
      expect(position.board[_boardId(4, 1)]).toBeUndefined();
      expect(MoveApplicationService.deletePiece(position, _boardId(4, 1))).toBe(false);
    });
    it('relocates a piece, rejecting an empty origin or a move to the same square', () => {
      const position = createInitialBoardPosition();

      expect(MoveApplicationService.movePiece(position, _boardId(4, 1), _boardId(4, 3))).toBe(true);
      expect(position.board[_boardId(4, 1)]).toBeUndefined();
      expect(position.board[_boardId(4, 3)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White });
      expect(MoveApplicationService.movePiece(position, _boardId(4, 1), _boardId(4, 2))).toBe(false);
      expect(MoveApplicationService.movePiece(position, _boardId(4, 3), _boardId(4, 3))).toBe(false);
    });
    it('replaces a different piece, removes an equal one, and adds to an empty square', () => {
      const position = createInitialBoardPosition();
      const target = _boardId(4, 4);
      const knight = { kind: PieceKind.Knight, colour: PlayerColour.White };

      expect(MoveApplicationService.togglePiece(position, target, knight)).toBe(true);
      expect(position.board[target]).toEqual(knight);
      expect(MoveApplicationService.togglePiece(position, target, { kind: PieceKind.Queen, colour: PlayerColour.Black })).toBe(true);
      expect(position.board[target]).toEqual({ kind: PieceKind.Queen, colour: PlayerColour.Black });
      expect(MoveApplicationService.togglePiece(position, target, { kind: PieceKind.Queen, colour: PlayerColour.Black })).toBe(true);
      expect(position.board[target]).toBeUndefined();
    });
    it('drops the runtime metadata an effective edit invalidates', () => {
      const position = createInitialBoardPosition();
      expect(position.$?.isStandardInitialPosition).toBe(true);

      MoveApplicationService.deletePiece(position, _boardId(4, 1));

      expect(position.$).toBeUndefined();
    });
  });
});
