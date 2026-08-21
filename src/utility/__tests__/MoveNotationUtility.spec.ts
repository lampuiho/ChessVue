import { describe, expect, it } from 'vitest';

import { PieceKind, PlayerColour, type IMoveRaw } from '@/contracts';
import { applyMove, buildFen, createInitialBoardPosition, createSparseBoard, getSan, getUci, toDetailedMove } from '@/utility/chess';

const boardId = (file: number, rank: number) => file + (rank * 8);

describe('MoveNotationUtility', () => {
  it('builds SAN for castling, captures, promotion, check, and mate', () => {
    const castlePosition = {
      ...createSparseBoard([
      { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.White),
      castlingAvailability: {
        whiteKingSide: true,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
      },
    };
    const castleMove: IMoveRaw = { from: boardId(4, 0), to: boardId(6, 0) };
    expect(getSan(toDetailedMove(castlePosition, castleMove))).toBe('O-O');

    const capturePosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(3, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
      { boardId: boardId(6, 6), piece: { kind: PieceKind.Knight, colour: PlayerColour.Black } },
      { boardId: boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White);
    const captureMove: IMoveRaw = { from: boardId(3, 3), to: boardId(6, 6) };
    expect(getSan(toDetailedMove(capturePosition, captureMove))).toBe('Bxg7');

    const promotionPosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White);
    const promotionMove: IMoveRaw = { from: boardId(4, 6), to: boardId(4, 7), promotionPiece: PieceKind.Queen };
    expect(getSan(toDetailedMove(promotionPosition, promotionMove))).toBe('e8=Q+');

    const matePosition = createSparseBoard([
      { boardId: boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White);
    const mateMove: IMoveRaw = { from: boardId(7, 5), to: boardId(6, 6) };
    expect(getSan(toDetailedMove(matePosition, mateMove))).toBe('Qg7#');
  });

  it('builds SAN disambiguation and runtime decoration', () => {
    const position = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(0, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(0, 3), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White);
    const move = toDetailedMove(position, { from: boardId(0, 1), to: boardId(0, 2) });

    expect(getSan(move)).toBe('R2a3');
    expect(getUci(move)).toBe('a2a3');
    expect(move.$).toEqual({
      san: 'R2a3',
      uci: 'a2a3',
    });
  })
  describe('buildFen', () => {
    it('serialises the board, side to move, castling, en passant, and clocks', () => {
      expect(buildFen(createInitialBoardPosition())).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });
    it('writes a dash when no castling right remains', () => {
      const position = createSparseBoard([
        { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
        { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      ], PlayerColour.Black);

      expect(buildFen(position)).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
    });
    it('caches the result under the position runtime metadata', () => {
      const position = createInitialBoardPosition();

      const fen = buildFen(position);

      expect(position.$?.fen).toBe(fen);
    });
    it('drops the cached fen once the position changes', () => {
      const position = createInitialBoardPosition();
      buildFen(position);

      applyMove(position, toDetailedMove(position, { from: boardId(4, 1), to: boardId(4, 3) }));

      expect(position.$?.fen).toBeUndefined();
      expect(buildFen(position)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    });
  });
});
