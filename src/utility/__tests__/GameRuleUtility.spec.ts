import { describe, expect, it } from 'vitest';

import { AmbiguityKind, CheckState, MoveKind, PieceKind, PlayerColour, ResultReason, ResultState, type BoardId, type IBoardPosition, type IMove } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard, genDetailedMoves, genLegalMoves, genNextPosition, getCheckState, isMoveLegal, isStandardInitialPosition, resolveGameResult, toDetailedMove } from '@/utility/chess';

const boardId = (file: number, rank: number): BoardId => file + (rank * 8);

function withPosition(position: IBoardPosition, overrides: Partial<IBoardPosition>): IBoardPosition {
  return { ...position, ...overrides };
}
function findMove(position: IBoardPosition, from: BoardId, to: BoardId): IMove | undefined {
  return genLegalMoves(position).find(move => move.from === from && move.to === to);
}
function enableWhiteCastling(position: IBoardPosition, kingSide = true, queenSide = true): IBoardPosition {
  return withPosition(position, {
    castlingAvailability: { whiteKingSide: kingSide, whiteQueenSide: queenSide, blackKingSide: false, blackQueenSide: false },
  });
}
function createKnightAmbiguityPosition(knights: BoardId[]): IBoardPosition {
  return createSparseBoard([
    ...knights.map(from => ({ boardId: from, piece: { kind: PieceKind.Knight, colour: PlayerColour.White } })),
    { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
    { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
  ]);
}

describe('GameRuleUtility', () => {
  describe('initial position', () => {
    it('clones the static board array while sharing immutable pieces', () => {
      const first = createInitialBoardPosition();
      const second = createInitialBoardPosition();

      expect(first.$?.isStandardInitialPosition).toBe(true);
      expect(first.board).not.toBe(second.board);
      expect(first.board[boardId(0, 0)]).toBe(second.board[boardId(0, 0)]);
      expect(isStandardInitialPosition(first)).toBe(true);
      first.board[boardId(0, 0)] = undefined;
      expect(second.board[boardId(0, 0)]).toEqual({ kind: PieceKind.Rook, colour: PlayerColour.White });
      expect(isStandardInitialPosition(first)).toBe(false);
    });

    it('requires standard state and standard castling-rook positions', () => {
      const changedTurn = withPosition(createInitialBoardPosition(), { sideToMove: PlayerColour.Black });
      const customRooks = withPosition(createInitialBoardPosition(), {
        castlingRook: {
          whiteKingSide: boardId(6, 0),
          whiteQueenSide: boardId(1, 0),
          blackKingSide: boardId(6, 7),
          blackQueenSide: boardId(1, 7),
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
      const move = toDetailedMove(position, { from: boardId(4, 1), to: boardId(4, 3), $: { uci: 'e2e4' } });

      expect(move).toMatchObject({
        from: boardId(4, 1),
        to: boardId(4, 3),
        kind: MoveKind.Normal,
        movingColour: PlayerColour.White,
        movingPiece: PieceKind.Pawn,
        $: { uci: 'e2e4' },
      });
      expect(position).toEqual(original);
    });

    it('describes the captured pawn for en passant', () => {
      const position = withPosition(createSparseBoard([
        { boardId: boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: boardId(3, 5) });

      expect(toDetailedMove(position, { from: boardId(4, 4), to: boardId(3, 5) })).toMatchObject({
        kind: MoveKind.EnPassant,
        capturePiece: PieceKind.Pawn,
      });
    });

    it.each([
      ['rank', [boardId(1, 0), boardId(5, 0)], AmbiguityKind.SameRankOnly],
      ['file', [boardId(1, 0), boardId(1, 2)], AmbiguityKind.SameFileOnly],
      ['rank and file', [boardId(1, 0), boardId(5, 0), boardId(1, 2)], AmbiguityKind.Both],
    ] as const)('reports $0 ambiguity between identical pieces', (_name, knights, expected) => {
      const position = createKnightAmbiguityPosition([...knights]);

      expect(toDetailedMove(position, { from: boardId(1, 0), to: boardId(3, 1) }).ambiguityKind).toBe(expected);
    });

    it('details a sequence against each resulting position', () => {
      const moves = genDetailedMoves(createInitialBoardPosition(), [
        { from: boardId(4, 1), to: boardId(4, 3) },
        { from: boardId(3, 6), to: boardId(3, 4) },
        { from: boardId(4, 3), to: boardId(3, 4) },
      ]);

      expect(moves.map(move => move.movingColour)).toEqual([PlayerColour.White, PlayerColour.Black, PlayerColour.White]);
      expect(moves.map(move => move.movingPiece)).toEqual([PieceKind.Pawn, PieceKind.Pawn, PieceKind.Pawn]);
      expect(moves[2]?.capturePiece).toBe(PieceKind.Pawn);
    });

    it('invalidates cached position facts after applying a move', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(1, 4), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      expect(getCheckState(position)).toBe(CheckState.Check);
      const move = toDetailedMove(position, { from: boardId(1, 4), to: boardId(4, 1) });

      expect(move.checkState).toBeUndefined();
      expect(genNextPosition(position, move).$).toBeUndefined();
    });
  });

  describe('checks and king safety', () => {
    it('rejects a pinned piece move that exposes its king', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(4, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: boardId(4, 1), to: boardId(5, 1) })).toBe(false);
      expect(isMoveLegal(position, { from: boardId(4, 1), to: boardId(4, 2) })).toBe(true);
    });

    it('treats empty pawn diagonals as attacked king destinations', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 2), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: boardId(4, 2), to: boardId(4, 3) })).toBe(false);
    });

    it('does not let the king capture a defended piece', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 3), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(5, 4), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 5), piece: { kind: PieceKind.Knight, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: boardId(4, 3), to: boardId(5, 4) })).toBe(false);
    });

    it('x-rays sliding attacks through the king', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(0, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(isMoveLegal(position, { from: boardId(4, 0), to: boardId(5, 0) })).toBe(false);
    });

    it('allows blocking a single sliding check', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(1, 4), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(isMoveLegal(position, { from: boardId(1, 4), to: boardId(4, 1) })).toBe(true);
    });

    it('allows only king moves during double check', () => {
      const king = boardId(4, 0);
      const position = createSparseBoard([
        { boardId: king, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(0, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(1, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const moves = genLegalMoves(position);

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.every(move => move.from === king)).toBe(true);
    });

    it('never generates a move that captures the opposing king', () => {
      const position = createSparseBoard([
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(findMove(position, boardId(7, 0), boardId(7, 7))).toBeUndefined();
    });
  });

  describe('castling', () => {
    it('generates both standard castling moves when clear and safe', () => {
      const position = enableWhiteCastling(createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(0, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]));

      expect(findMove(position, boardId(4, 0), boardId(2, 0))?.kind).toBe(MoveKind.Castle);
      expect(findMove(position, boardId(4, 0), boardId(6, 0))?.kind).toBe(MoveKind.Castle);
    });

    it('rejects castling while checked', () => {
      const position = enableWhiteCastling(createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);

      expect(isMoveLegal(position, { from: boardId(4, 0), to: boardId(6, 0) })).toBe(false);
    });

    it('rejects castling through attack or an occupied path', () => {
      const attacked = enableWhiteCastling(createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(5, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);
      const blocked = enableWhiteCastling(createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(5, 0), piece: { kind: PieceKind.Knight, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);

      expect(isMoveLegal(attacked, { from: boardId(4, 0), to: boardId(6, 0) })).toBe(false);
      expect(isMoveLegal(blocked, { from: boardId(4, 0), to: boardId(6, 0) })).toBe(false);
    });

    it('uses configured freestyle rooks with two-square king gestures', () => {
      const position = enableWhiteCastling(withPosition(createSparseBoard([
        { boardId: boardId(3, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(1, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(6, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), {
        castlingRook: {
          whiteKingSide: boardId(6, 0),
          whiteQueenSide: boardId(1, 0),
          blackKingSide: boardId(7, 7),
          blackQueenSide: boardId(0, 7),
        },
      }));

      expect(findMove(position, boardId(3, 0), boardId(1, 0))?.kind).toBe(MoveKind.Castle);
      expect(findMove(position, boardId(3, 0), boardId(5, 0))?.kind).toBe(MoveKind.Castle);
    });

    it('places freestyle pieces on fixed final squares', () => {
      const position = enableWhiteCastling(withPosition(createSparseBoard([
        { boardId: boardId(3, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(6, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), {
        castlingRook: {
          whiteKingSide: boardId(6, 0),
          whiteQueenSide: boardId(0, 0),
          blackKingSide: boardId(7, 7),
          blackQueenSide: boardId(0, 7),
        },
      }), true, false);
      const move = findMove(position, boardId(3, 0), boardId(5, 0))!;
      const nextPosition = genNextPosition(position, move);

      expect(nextPosition.board[boardId(6, 0)]).toEqual({ kind: PieceKind.King, colour: PlayerColour.White });
      expect(nextPosition.board[boardId(5, 0)]).toEqual({ kind: PieceKind.Rook, colour: PlayerColour.White });
      expect(position.board[boardId(3, 0)]).toEqual({ kind: PieceKind.King, colour: PlayerColour.White });
    });

    it('tracks only the configured rook for castling availability', () => {
      const position = enableWhiteCastling(createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(5, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), true, false);
      const unrelatedMove = toDetailedMove(position, { from: boardId(5, 1), to: boardId(5, 2) });
      const eligibleMove = toDetailedMove(position, { from: boardId(7, 0), to: boardId(7, 1) });

      expect(genNextPosition(position, unrelatedMove).castlingAvailability.whiteKingSide).toBe(true);
      expect(genNextPosition(position, eligibleMove).castlingAvailability.whiteKingSide).toBe(false);
    });
  });

  describe('en passant', () => {
    it('generates and applies the capture without mutating the source', () => {
      const position = withPosition(createSparseBoard([
        { boardId: boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: boardId(3, 5) });
      const move = findMove(position, boardId(4, 4), boardId(3, 5))!;
      const nextPosition = genNextPosition(position, move);

      expect(move.kind).toBe(MoveKind.EnPassant);
      expect(nextPosition.board[boardId(3, 4)]).toBeUndefined();
      expect(nextPosition.board[boardId(3, 5)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White });
      expect(position.board[boardId(3, 4)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.Black });
    });

    it('rejects the capture when removing both pawns exposes the king', () => {
      const position = withPosition(createSparseBoard([
        { boardId: boardId(0, 4), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(1, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: boardId(2, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(7, 4), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: boardId(2, 5) });

      expect(isMoveLegal(position, { from: boardId(1, 4), to: boardId(2, 5) })).toBe(false);
    });

    it('allows en passant to capture the checking pawn', () => {
      const position = withPosition(createSparseBoard([
        { boardId: boardId(4, 3), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]), { enPassantTarget: boardId(3, 5) });

      expect(getCheckState(position)).toBe(CheckState.Check);
      expect(isMoveLegal(position, { from: boardId(4, 4), to: boardId(3, 5) })).toBe(true);
    });

    it('sets the passed square after a two-square pawn move', () => {
      const position = createInitialBoardPosition();
      const move = toDetailedMove(position, { from: boardId(4, 1), to: boardId(4, 3) });

      expect(genNextPosition(position, move).enPassantTarget).toBe(boardId(4, 2));

      const blackPosition = createSparseBoard([
        { boardId: boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);
      const blackMove = toDetailedMove(blackPosition, { from: boardId(4, 6), to: boardId(4, 4) });
      expect(genNextPosition(blackPosition, blackMove).enPassantTarget).toBe(boardId(4, 5));
    });
  });

  describe('promotion', () => {
    it('applies the selected piece and calculates check', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const move = toDetailedMove(position, { from: boardId(4, 6), to: boardId(4, 7), promotionPiece: PieceKind.Queen });
      const nextPosition = genNextPosition(position, move);

      expect(move.checkState).toBe(CheckState.Check);
      expect(nextPosition.board[boardId(4, 7)]).toEqual({ kind: PieceKind.Queen, colour: PlayerColour.White });
    });
  });

  describe('game result', () => {
    it('resolves checkmate and marks a mating move', () => {
      const checkmate = createSparseBoard([
        { boardId: boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(6, 6), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);
      const beforeMate = createSparseBoard([
        { boardId: boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(6, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(checkmate)).toEqual({ resultState: ResultState.WhiteWon, resultReason: ResultReason.RuleResolved });
      expect(getCheckState(checkmate)).toBe(CheckState.Checkmate);
      expect(toDetailedMove(beforeMate, { from: boardId(6, 5), to: boardId(6, 6) }).checkState).toBe(CheckState.Checkmate);
    });

    it('resolves stalemate', () => {
      const position = createSparseBoard([
        { boardId: boardId(5, 6), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(6, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);

      expect(resolveGameResult(position)).toEqual({ resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved });
      expect(getCheckState(position)).toBeUndefined();
    });

    it('draws for bare kings and a lone minor piece', () => {
      for (const kind of [undefined, PieceKind.Bishop, PieceKind.Knight]) {
        const position = createSparseBoard([
          { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
          ...(kind === undefined ? [] : [{ boardId: boardId(2, 0), piece: { kind, colour: PlayerColour.White } }]),
          { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
        ]);
        expect(resolveGameResult(position).resultState).toBe(ResultState.Drawn);
      }
    });

    it('keeps playing when bishop and knight can mate', () => {
      const position = createSparseBoard([
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(1, 0), piece: { kind: PieceKind.Knight, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(position)).toEqual({ resultState: ResultState.Ongoing, resultReason: undefined });
    });

    it('distinguishes same-colour bishops from a mating bishop pair', () => {
      const sameColourBishops = createSparseBoard([
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(5, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.Black } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);
      const bishopPair = createSparseBoard([
        { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(2, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(5, 0), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
        { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ]);

      expect(resolveGameResult(sameColourBishops).resultState).toBe(ResultState.Drawn);
      expect(resolveGameResult(bishopPair).resultState).toBe(ResultState.Ongoing);
    });
  });
});
