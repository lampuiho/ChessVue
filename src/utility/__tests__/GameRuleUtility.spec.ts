import { describe, expect, it } from 'vitest';

import { AmbiguityKind, CheckState, MoveKind, PieceKind, PlayerColour, ResultReason, ResultState, type BoardId, type IBoardPosition, type IMove, type IMoveRaw } from '@/contracts';
import { applyMove, createInitialBoardPosition, createSparseBoard, genDetailedMoves, genLegalMoves, genLegalMovesForPiece, genNextPosition, getCheckState, isMoveLegal, isStandardInitialPosition, requiresPromotionSelection, resolveGameResult, toDetailedMove } from '@/utility/chess';
import * as chess from '@/utility/chess';
import * as gameRule from '@/utility/chess/GameRuleUtility';
import { castlePosition, fixturePosition, premove, promotionPosition, squareId, whiteChain, type IPositionFixture } from '@/state/__tests__/PremoveFixture';
import { attackedCastle, pinned } from '@/state/__tests__/PremoveProjectionScenario';

const _boardId = (file: number, rank: number): BoardId => file + (rank * 8);

function _withPosition(position: IBoardPosition, overrides: Partial<IBoardPosition>): IBoardPosition {
  return { ...position, $: undefined, ...overrides };
}
function _findMove(position: IBoardPosition, from: BoardId, to: BoardId): IMove | undefined {
  return genLegalMoves(position).find(move => move.from === from && move.to === to);
}
function _enableWhiteCastling(position: IBoardPosition, kingSide = true, queenSide = true): IBoardPosition {
  return _withPosition(position, {
    castlingAvailability: { whiteKingSide: kingSide, whiteQueenSide: queenSide, blackKingSide: false, blackQueenSide: false },
  });
}
function _createKnightAmbiguityPosition(knights: BoardId[]): IBoardPosition {
  return createSparseBoard([
    ...knights.map(from => ({ boardId: from, piece: { kind: PieceKind.Knight, colour: PlayerColour.White } })),
    { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
    { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
  ]);
}

describe('GameRuleUtility', () => {
  describe('initial position', () => {
    it('clones the static board array while sharing immutable pieces', () => {
      const first = createInitialBoardPosition();
      const second = createInitialBoardPosition();

      expect(first.$?.isStandardInitialPosition).toBe(true);
      expect(first.board).not.toBe(second.board);
      expect(first.board[_boardId(0, 0)]).toBe(second.board[_boardId(0, 0)]);
      expect(isStandardInitialPosition(first)).toBe(true);
      first.board[_boardId(0, 0)] = undefined;
      first.$ = undefined;
      expect(second.board[_boardId(0, 0)]).toEqual({ kind: PieceKind.Rook, colour: PlayerColour.White });
      expect(isStandardInitialPosition(first)).toBe(false);
    });

    it('requires standard state and standard castling-rook positions', () => {
      const changedTurn = _withPosition(createInitialBoardPosition(), { sideToMove: PlayerColour.Black });
      const customRooks = _withPosition(createInitialBoardPosition(), {
        castlingRook: {
          whiteKingSide: _boardId(6, 0),
          whiteQueenSide: _boardId(1, 0),
          blackKingSide: _boardId(6, 7),
          blackQueenSide: _boardId(1, 7),
        },
      });

      expect(isStandardInitialPosition(changedTurn)).toBe(false);
      expect(isStandardInitialPosition(customRooks)).toBe(false);
    });

    it('generates all 20 legal opening moves', () => {
      const moves = genLegalMoves(createInitialBoardPosition());

      expect(moves).toHaveLength(20);
      expect(moves.filter(move => move.movingPiece === PieceKind.Pawn)).toHaveLength(16);
      expect(moves.filter(move => move.movingPiece === PieceKind.Knight)).toHaveLength(4);
    });
  });

  describe('move details', () => {
    it('enriches a raw move without mutating its position', () => {
      const position = createInitialBoardPosition();
      const original = structuredClone(position);
      const move = toDetailedMove(position, { from: _boardId(4, 1), to: _boardId(4, 3), $: { uci: 'e2e4' } });

      expect(move).toMatchObject({
        from: _boardId(4, 1),
        to: _boardId(4, 3),
        kind: MoveKind.Normal,
        movingColour: PlayerColour.White,
        movingPiece: PieceKind.Pawn,
        $: { uci: 'e2e4' },
      });
      expect(position).toEqual(original);
    });

    it('describes the captured pawn for en passant', () => {
      const position = _withPosition(createSparseBoard([
        { boardId: _boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: _boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: _boardId(3, 5) });

      expect(toDetailedMove(position, { from: _boardId(4, 4), to: _boardId(3, 5) })).toMatchObject({
        kind: MoveKind.EnPassant,
        capturePiece: PieceKind.Pawn,
      });
    });

    it.each([
      ['rank', [_boardId(1, 0), _boardId(5, 0)], AmbiguityKind.SameRankOnly],
      ['file', [_boardId(1, 0), _boardId(1, 2)], AmbiguityKind.SameFileOnly],
      ['rank and file', [_boardId(1, 0), _boardId(5, 0), _boardId(1, 2)], AmbiguityKind.Both],
    ] as const)('reports $0 ambiguity between identical pieces', (_name, knights, expected) => {
      const position = _createKnightAmbiguityPosition([...knights]);

      expect(toDetailedMove(position, { from: _boardId(1, 0), to: _boardId(3, 1) }).ambiguityKind).toBe(expected);
    });

    it('details a sequence against each resulting position', () => {
      const moves = genDetailedMoves(createInitialBoardPosition(), [
        { from: _boardId(4, 1), to: _boardId(4, 3) },
        { from: _boardId(3, 6), to: _boardId(3, 4) },
        { from: _boardId(4, 3), to: _boardId(3, 4) },
      ]);

      expect(moves.map(move => move.movingColour)).toEqual([PlayerColour.White, PlayerColour.Black, PlayerColour.White]);
      expect(moves.map(move => move.movingPiece)).toEqual([PieceKind.Pawn, PieceKind.Pawn, PieceKind.Pawn]);
      expect(moves[2]?.capturePiece).toBe(PieceKind.Pawn);
    });

    it('invalidates cached position facts after applying a move', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(1, 4), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      expect(getCheckState(position)).toBe(CheckState.Check);
      const move = toDetailedMove(position, { from: _boardId(1, 4), to: _boardId(4, 1) });

      expect(move.checkState).toBeUndefined();
      expect(genNextPosition(position, move).$).toBeUndefined();
    });

    it('applies a detailed move to the supplied position', () => {
      const position = createInitialBoardPosition();
      const move = toDetailedMove(position, { from: _boardId(4, 1), to: _boardId(4, 3) });

      expect(applyMove(position, move)).toBe(position);
      expect(position.board[_boardId(4, 1)]).toBeUndefined();
      expect(position.board[_boardId(4, 3)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White });
      expect(position.sideToMove).toBe(PlayerColour.Black);
    });
  });

  describe('legal moves for a piece', () => {
    it('returns raw moves only for the selected piece', () => {
      const position = createInitialBoardPosition();
      const from = _boardId(4, 1);
      const moves = genLegalMovesForPiece(position, from);

      expect(moves).toEqual([
        { from, to: _boardId(4, 2) },
        { from, to: _boardId(4, 3) },
      ]);
      expect(genLegalMovesForPiece(position, _boardId(4, 6))).toEqual([]);
    });

    it('skips the attack state after a known non-check while still rejecting pinned moves', () => {
      const from = _boardId(4, 1);
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: from, piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(0, 5), piece: { kind: PieceKind.Knight, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const lastMove: IMove = { from: _boardId(1, 7), to: _boardId(0, 5), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Knight };
      const moves = genLegalMovesForPiece(position, from, lastMove);

      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every(move => move.to % 8 === 4)).toBe(true);
      expect(moves).not.toContainEqual({ from, to: _boardId(5, 1) });
    });

    it('calculates checking attacks for non-king responses', () => {
      const from = _boardId(1, 4);
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: from, piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const lastMove: IMove = { from: _boardId(4, 6), to: _boardId(4, 7), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Rook, checkState: CheckState.Check };

      expect(genLegalMovesForPiece(position, from, lastMove)).toEqual([
        { from, to: _boardId(4, 1) },
        { from, to: _boardId(4, 7) },
      ]);
    });

    it('always calculates the attack mask for king moves', () => {
      const from = _boardId(4, 2);
      const position = createSparseBoard([
        { boardId: from, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const lastMove: IMove = { from: _boardId(3, 5), to: _boardId(3, 4), kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn };

      expect(genLegalMovesForPiece(position, from, lastMove)).not.toContainEqual({ from, to: _boardId(4, 3) });
    });
  });

  describe('checks and king safety', () => {
    it('rejects a pinned piece move that exposes its king', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(4, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: _boardId(4, 1), to: _boardId(5, 1) })).toBe(false);
      expect(isMoveLegal(position, { from: _boardId(4, 1), to: _boardId(4, 2) })).toBe(true);
    });

    it('treats empty pawn diagonals as attacked king destinations', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 2), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: _boardId(4, 2), to: _boardId(4, 3) })).toBe(false);
    });

    it('does not let the king capture a defended piece', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 3), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(5, 4), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 5), piece: { kind: PieceKind.Knight, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: _boardId(4, 3), to: _boardId(5, 4) })).toBe(false);
    });

    it('x-rays sliding attacks through the king', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: _boardId(4, 0), to: _boardId(5, 0) })).toBe(false);
    });

    it('allows blocking a single sliding check', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(1, 4), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(isMoveLegal(position, { from: _boardId(1, 4), to: _boardId(4, 1) })).toBe(true);
    });

    it('allows only king moves during double check', () => {
      const king = _boardId(4, 0);
      const position = createSparseBoard([
        { boardId: king, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(0, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(1, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const moves = genLegalMoves(position);

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every(move => move.from === king)).toBe(true);
    });

    it('never generates a move that captures the opposing king', () => {
      const position = createSparseBoard([
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(_findMove(position, _boardId(7, 0), _boardId(7, 7))).toBeUndefined();
    });
  });

  describe('castling', () => {
    it('generates both standard castling moves when clear and safe', () => {
      const position = _enableWhiteCastling(createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]));

      expect(_findMove(position, _boardId(4, 0), _boardId(2, 0))?.kind).toBe(MoveKind.Castle);
      expect(_findMove(position, _boardId(4, 0), _boardId(6, 0))?.kind).toBe(MoveKind.Castle);
    });

    it('rejects castling while checked', () => {
      const position = _enableWhiteCastling(createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);

      expect(isMoveLegal(position, { from: _boardId(4, 0), to: _boardId(6, 0) })).toBe(false);
    });

    it('rejects castling through attack or an occupied path', () => {
      const attacked = _enableWhiteCastling(createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(5, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);
      const blocked = _enableWhiteCastling(createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(5, 0), piece: { kind: PieceKind.Knight, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);

      expect(isMoveLegal(attacked, { from: _boardId(4, 0), to: _boardId(6, 0) })).toBe(false);
      expect(isMoveLegal(blocked, { from: _boardId(4, 0), to: _boardId(6, 0) })).toBe(false);
    });

    it('uses configured freestyle rooks with two-square king gestures', () => {
      const position = _enableWhiteCastling(_withPosition(createSparseBoard([
        { boardId: _boardId(3, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(1, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(6, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), {
        castlingRook: {
          whiteKingSide: _boardId(6, 0),
          whiteQueenSide: _boardId(1, 0),
          blackKingSide: _boardId(7, 7),
          blackQueenSide: _boardId(0, 7),
        },
      }));

      expect(_findMove(position, _boardId(3, 0), _boardId(1, 0))?.kind).toBe(MoveKind.Castle);
      expect(_findMove(position, _boardId(3, 0), _boardId(5, 0))?.kind).toBe(MoveKind.Castle);
    });

    it('places freestyle pieces on fixed final squares', () => {
      const position = _enableWhiteCastling(_withPosition(createSparseBoard([
        { boardId: _boardId(3, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(6, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), {
        castlingRook: {
          whiteKingSide: _boardId(6, 0),
          whiteQueenSide: _boardId(0, 0),
          blackKingSide: _boardId(7, 7),
          blackQueenSide: _boardId(0, 7),
        },
      }), true, false);
      const move = _findMove(position, _boardId(3, 0), _boardId(5, 0))!;
      const nextPosition = genNextPosition(position, move);

      expect(nextPosition.board[_boardId(6, 0)]).toEqual({ kind: PieceKind.King, colour: PlayerColour.White });
      expect(nextPosition.board[_boardId(5, 0)]).toEqual({ kind: PieceKind.Rook, colour: PlayerColour.White });
      expect(position.board[_boardId(3, 0)]).toEqual({ kind: PieceKind.King, colour: PlayerColour.White });
    });

    it('tracks only the configured rook for castling availability', () => {
      const position = _enableWhiteCastling(createSparseBoard([
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(5, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);
      const unrelatedMove = toDetailedMove(position, { from: _boardId(5, 1), to: _boardId(5, 2) });
      const eligibleMove = toDetailedMove(position, { from: _boardId(7, 0), to: _boardId(7, 1) });

      expect(genNextPosition(position, unrelatedMove).castlingAvailability.whiteKingSide).toBe(true);
      expect(genNextPosition(position, eligibleMove).castlingAvailability.whiteKingSide).toBe(false);
    });
  });

  describe('en passant', () => {
    it('generates and applies the capture without mutating the source', () => {
      const position = _withPosition(createSparseBoard([
        { boardId: _boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: _boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: _boardId(3, 5) });
      const move = _findMove(position, _boardId(4, 4), _boardId(3, 5))!;
      const nextPosition = genNextPosition(position, move);

      expect(move.kind).toBe(MoveKind.EnPassant);
      expect(nextPosition.board[_boardId(3, 4)]).toBeUndefined();
      expect(nextPosition.board[_boardId(3, 5)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White });
      expect(position.board[_boardId(3, 4)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.Black });
    });

    it('rejects the capture when removing both pawns exposes the king', () => {
      const position = _withPosition(createSparseBoard([
        { boardId: _boardId(0, 4), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(1, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: _boardId(2, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 4), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: _boardId(2, 5) });

      expect(isMoveLegal(position, { from: _boardId(1, 4), to: _boardId(2, 5) })).toBe(false);
    });

    it('allows en passant to capture the checking pawn', () => {
      const position = _withPosition(createSparseBoard([
        { boardId: _boardId(4, 3), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: _boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: _boardId(3, 5) });

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(isMoveLegal(position, { from: _boardId(4, 4), to: _boardId(3, 5) })).toBe(true);
    });

    it('sets the passed square after a two-square pawn move', () => {
      const position = createInitialBoardPosition();
      const move = toDetailedMove(position, { from: _boardId(4, 1), to: _boardId(4, 3) });

      expect(genNextPosition(position, move).enPassantTarget).toBe(_boardId(4, 2));

      const blackPosition = createSparseBoard([
        { boardId: _boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);
      const blackMove = toDetailedMove(blackPosition, { from: _boardId(4, 6), to: _boardId(4, 4) });
      expect(genNextPosition(blackPosition, blackMove).enPassantTarget).toBe(_boardId(4, 5));
    });
  });

  describe('promotion', () => {
    it('detects whether a raw pawn move needs a promotion selection', () => {
      const pawnFrom = _boardId(4, 6);
      const rookFrom = _boardId(1, 6);
      const promotionTo = _boardId(4, 7);
      const position = createSparseBoard([
        { boardId: pawnFrom, piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: rookFrom, piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(requiresPromotionSelection(position, { from: pawnFrom, to: promotionTo })).toBe(true);
      expect(requiresPromotionSelection(position, { from: pawnFrom, to: promotionTo, promotionPiece: PieceKind.Queen })).toBe(false);
      expect(requiresPromotionSelection(position, { from: pawnFrom, to: _boardId(4, 5) })).toBe(false);
      expect(requiresPromotionSelection(position, { from: rookFrom, to: _boardId(1, 7) })).toBe(false);
      expect(() => requiresPromotionSelection(position, { from: _boardId(2, 6), to: _boardId(2, 7) })).toThrow(/expecting a piece/);
    });

    it('generates each promotion piece for forward moves and captures', () => {
      const from = _boardId(4, 6);
      const forwardTo = _boardId(4, 7);
      const captureTo = _boardId(3, 7);
      const position = createSparseBoard([
        { boardId: from, piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: captureTo, piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const moves = genLegalMoves(position).filter(move => move.from === from);
      const forwardMoves = moves.filter(move => move.to === forwardTo);
      const captureMoves = moves.filter(move => move.to === captureTo);
      const expectedPromotionPieces = [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight];

      expect(forwardMoves).toHaveLength(4);
      expect(captureMoves).toHaveLength(4);
      expect(moves.every(move => move.kind === MoveKind.Promotion)).toBe(true);
      expect(forwardMoves.map(move => move.promotionPiece)).toEqual(expectedPromotionPieces);
      expect(captureMoves.map(move => move.promotionPiece)).toEqual(expectedPromotionPieces);
      expect(captureMoves.every(move => move.capturePiece === PieceKind.Rook)).toBe(true);
    });

    it('applies the selected piece and calculates check', () => {
      const position = createSparseBoard([
        { boardId: _boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const move = toDetailedMove(position, { from: _boardId(4, 6), to: _boardId(4, 7), promotionPiece: PieceKind.Queen });
      const nextPosition = genNextPosition(position, move);

      expect(move.checkState).toBe(CheckState.Check);
      expect(nextPosition.board[_boardId(4, 7)]).toEqual({ kind: PieceKind.Queen, colour: PlayerColour.White });
    });
  });

  describe('game result', () => {
    it('resolves checkmate and marks a mating move', () => {
      const checkmate = createSparseBoard([
        { boardId: _boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(6, 6), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);
      const beforeMate = createSparseBoard([
        { boardId: _boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(6, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(checkmate)).toEqual({ resultState: ResultState.WhiteWon, resultReason: ResultReason.RuleResolved });
      expect(getCheckState(checkmate)).toBe(CheckState.Checkmate);
      expect(toDetailedMove(beforeMate, { from: _boardId(6, 5), to: _boardId(6, 6) }).checkState).toBe(CheckState.Checkmate);
    });

    it('resolves stalemate', () => {
      const position = createSparseBoard([
        { boardId: _boardId(5, 6), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(6, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);

      expect(resolveGameResult(position)).toEqual({ resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved });
      expect(getCheckState(position)).toBeUndefined();
      expect(position.$?.isCheckStateCached).toBe(true);
    });

    it('draws for bare kings and a lone minor piece', () => {
      for (const kind of [undefined, PieceKind.Bishop, PieceKind.Knight]) {
        const position = createSparseBoard([
          { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
          ...(kind === undefined ? [] : [{ boardId: _boardId(2, 0), piece: { kind, colour: PlayerColour.White } }]),
          { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
        ]);
        expect(resolveGameResult(position).resultState).toBe(ResultState.Drawn);
      }
    });

    it('keeps playing when bishop and knight can mate', () => {
      const position = createSparseBoard([
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(1, 0), piece: { kind: PieceKind.Knight, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(position)).toEqual({ resultState: ResultState.Ongoing, resultReason: undefined });
    });

    it('distinguishes same-colour bishops from a mating bishop pair', () => {
      const sameColourBishops = createSparseBoard([
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(5, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.Black } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const bishopPair = createSparseBoard([
        { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: _boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(5, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(sameColourBishops).resultState).toBe(ResultState.Drawn);
      expect(resolveGameResult(bishopPair).resultState).toBe(ResultState.Ongoing);
    });
  });
});

// Premove capability and queue ownership stay in state; these are chess-rule cases.
const white = PlayerColour.White;
const black = PlayerColour.Black;
const kings = [['e1', white, PieceKind.King], ['e8', black, PieceKind.King]] as const;
function _board(root?: IPositionFixture, played: readonly string[] = []) {
  const board = fixturePosition(root);
  let lastMove: IMove | undefined;
  for (const uci of played) {
    lastMove = chess.genLegalMoves(board).find((move) => chess.getUci(move) === uci);
    expect(lastMove, `Legal fixture move ${uci}`).toBeDefined();
    chess.applyMove(board, lastMove!);
  }
  return { board, lastMove };
}
function _freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) _freeze(child);
    Object.freeze(value);
  }
  return value;
}
function _targets(position: IBoardPosition, from: BoardId) {
  const generate = Reflect.get(gameRule, 'genCandidateMovesForPiece') as ((position: IBoardPosition, from: BoardId) => IMoveRaw[]) | undefined;
  expect(generate, 'Planned GameRuleUtility.genCandidateMovesForPiece is not implemented.').toBeTypeOf('function');
  return generate!(position, from);
}
describe('GameRuleUtility movement candidates', () => {
  it('PRE-S01 generates another knight move from the displaced board position', () => {
    const { board } = _board(undefined, ['e2e4', 'e7e5', 'g1f3']);
    const targets = _targets(_freeze(board), squareId('f3'));
    expect(targets.map(chess.getUci).sort()).toEqual(['f3d4', 'f3e5', 'f3g1', 'f3g5', 'f3h4']);
  });
  it('PRE-S17 generates piece-colour geometry independently of the actual side due', () => {
    const board = _freeze(fixturePosition());
    expect(_targets(board, squareId('g8')).map(chess.getUci).sort()).toEqual(['g8f6', 'g8h6']);
    expect(board.sideToMove).toBe(white);
  });
  it('PRE-S04 offers all four explicit promotion choices', () => {
    const targets = _targets(_freeze(fixturePosition(promotionPosition)), squareId('a7'));
    expect(targets.filter((move) => move.to === squareId('a8')).map((move) => move.promotionPiece).sort()).toEqual([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight].sort());
  });
  it('PRE-S09 keeps speculative castling separate from actual attacked-path legality', () => {
    expect(_targets(_freeze(fixturePosition(attackedCastle)), squareId('e1')).map(chess.getUci)).toContain('e1g1');
  });
});
interface IRuleResolutionCase {
  name: string;
  root?: IPositionFixture;
  played?: string[];
  intent: IMoveRaw;
  legal: boolean;
  expected?: Partial<IMove>;
}
const resolutionCases: IRuleResolutionCase[] = [
  { name: 'PRE-F07 resolves an actual normal move', played: ['e2e4', 'e7e5'], intent: whiteChain[0]!, legal: true, expected: { kind: MoveKind.Normal, movingColour: white, movingPiece: PieceKind.Knight } },
  { name: 'PRE-F07 refuses the wrong actual turn', played: ['e2e4'], intent: whiteChain[0]!, legal: false },
  { name: 'PRE-F07 reports actual source kind for matching coordinates', played: ['e2e4', 'e7e5'], intent: premove('g1f3', PieceKind.Bishop), legal: true, expected: { movingPiece: PieceKind.Knight } },
  { name: 'PRE-S09 pinned knight cannot expose its actual king', root: pinned, intent: premove('e2f4'), legal: false },
  { name: 'PRE-S09 king cannot actually enter attack', root: attackedCastle, intent: premove('e1f1', PieceKind.King), legal: false },
  { name: 'PRE-S04 actual castle must also have a safe path', root: attackedCastle, intent: premove('e1g1', PieceKind.King), legal: false },
  { name: 'PRE-S04 resolves valid actual castling', root: { ...castlePosition, side: white }, intent: premove('e1g1', PieceKind.King), legal: true, expected: { kind: MoveKind.Castle } },
  { name: 'PRE-S04 resolves current actual en-passant', played: ['e2e4', 'a7a6', 'e4e5', 'd7d5'], intent: premove('e5d6', PieceKind.Pawn), legal: true, expected: { kind: MoveKind.EnPassant, capturePiece: PieceKind.Pawn } },
  { name: 'PRE-S09 an empty diagonal without current en-passant is illegal', root: { side: white, pieces: [...kings, ['e5', white, PieceKind.Pawn], ['d5', black, PieceKind.Pawn]] }, intent: premove('e5d6', PieceKind.Pawn), legal: false },
  { name: 'PRE-S04 captures the actual bishop rather than invented old capture metadata', root: { side: white, pieces: [...kings, ['f3', white, PieceKind.Knight], ['g5', black, PieceKind.Bishop]] },
    intent: whiteChain[1]!, legal: true, expected: { capturePiece: PieceKind.Bishop, kind: MoveKind.Normal } },
  ...(['q', 'r', 'b', 'n'] as const).map((letter): IRuleResolutionCase => ({ name: `PRE-S04 resolves exact promotion ${letter}`, root: { ...promotionPosition, side: white }, intent: premove(`a7a8${letter}`, PieceKind.Pawn), legal: true,
    expected: { kind: MoveKind.Promotion, promotionPiece: premove(`a7a8${letter}`, PieceKind.Pawn).promotionPiece } })),
  { name: 'PRE-F07 never silently queens a missing promotion', root: { ...promotionPosition, side: white }, intent: premove('a7a8', PieceKind.Pawn), legal: false },
];
describe('GameRuleUtility existing legal candidates and details used for due premoves', () => {
  it.each(resolutionCases)('$name', (spec) => {
    const { board, lastMove } = _board(spec.root, spec.played);
    const before = structuredClone(board);
    const candidates = genLegalMovesForPiece(board, spec.intent.from, lastMove);
    const candidate = candidates.find((move) => move.to === spec.intent.to && move.promotionPiece === spec.intent.promotionPiece);
    expect(isMoveLegal(board, spec.intent)).toBe(spec.legal);
    expect(candidate !== undefined).toBe(spec.legal);
    if (candidate) {
      const detailed = toDetailedMove(board, candidate);
      expect(detailed).toMatchObject({ from: spec.intent.from, to: spec.intent.to, ...spec.expected });
      expect(isMoveLegal(board, detailed)).toBe(true);
    }
    expect(board).toEqual(before);
  });
});
