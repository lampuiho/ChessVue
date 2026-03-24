import { describe, expect, it } from 'vitest';

import { MoveKind, PieceKind, PlayerColour, ResultState, type IBoardPosition } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard, GameRuleService, normaliseBoardPosition, } from '..';

function withPosition(position: IBoardPosition, overrides: Partial<IBoardPosition>): IBoardPosition {
  return normaliseBoardPosition({
    ...position,
    ...overrides,
  })
}
describe('GameRuleService', () => {
  it('generates 20 legal opening moves', () => {
    const moves = GameRuleService.generateLegalMoves(createInitialBoardPosition())

    expect(moves).toHaveLength(20)
  })

  it('rejects moves that leave the king in check', () => {
    const position = createSparseBoard([
      { square: 'e1', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'e2', piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { square: 'e8', piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
      { square: 'h8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    const illegalMove = {
      from: 'e2',
      to: 'f2',
      kind: MoveKind.Normal,
      movingColour: PlayerColour.White,
      promotionPiece: null,
      san: 'Rf2',
      uci: 'e2f2',
    }

    expect(GameRuleService.isMoveLegal(position, illegalMove)).toBe(false)
  })

  it('allows legal castling when the path is clear and safe', () => {
    const position = withPosition(createSparseBoard([
      { square: 'e1', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'h1', piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { square: 'e8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]), {
      castlingAvailability: {
        whiteKingSide: true,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
      },
    })

    const moves = GameRuleService.generateLegalMoves(position)
    expect(moves.some((move) => move.kind === MoveKind.Castle && move.to === 'g1')).toBe(true)
  })

  it('supports en passant generation and application', () => {
    const position = withPosition(createSparseBoard([
      { square: 'e5', piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { square: 'd5', piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
      { square: 'e1', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'e8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]), {
      sideToMove: PlayerColour.White,
      enPassantTarget: 'd6',
    })

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.kind === MoveKind.EnPassant)

    expect(move).toBeDefined()
    const nextPosition = GameRuleService.applyMove(position, move!)
    expect(nextPosition.piecesBySquare.d5).toBeUndefined()
    expect(nextPosition.piecesBySquare.d6).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White })
  })

  it('requires explicit promotion selection', () => {
    const position = createSparseBoard([
      { square: 'e7', piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { square: 'a1', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'h8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.to === 'e8')!
    expect(GameRuleService.requiresPromotionSelection(position, move)).toBe(true)
    expect(() => GameRuleService.applyMove(position, move)).toThrow(/Promotion piece selection/)
  })

  it('resolves checkmate, stalemate, and insufficient material', () => {
    const checkmate = createSparseBoard([
      { square: 'f6', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'g7', piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { square: 'h8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.Black)

    const stalemate = createSparseBoard([
      { square: 'f7', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'g6', piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { square: 'h8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.Black)

    const insufficient = createSparseBoard([
      { square: 'a1', piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { square: 'h8', piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    expect(GameRuleService.resolveResult(checkmate).resultState).toBe(ResultState.WhiteWon)
    expect(GameRuleService.resolveResult(stalemate).resultState).toBe(ResultState.Drawn)
    expect(GameRuleService.resolveResult(insufficient).resultState).toBe(ResultState.Drawn)
  })
})
