import { describe, expect, it } from 'vitest'

import { createInitialBoardPosition, createSparseBoard, GameRuleService, normaliseBoardPosition, type IBoardPosition } from '../index'

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
      { square: 'e1', piece: { kind: 'king', colour: 'white' } },
      { square: 'e2', piece: { kind: 'rook', colour: 'white' } },
      { square: 'e8', piece: { kind: 'rook', colour: 'black' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ])

    const illegalMove = {
      from: 'e2',
      to: 'f2',
      kind: 'normal' as const,
      movingColour: 'white' as const,
      promotionPiece: null,
      san: 'Rf2',
      uci: 'e2f2',
    }

    expect(GameRuleService.isMoveLegal(position, illegalMove)).toBe(false)
  })

  it('allows legal castling when the path is clear and safe', () => {
    const position = withPosition(createSparseBoard([
      { square: 'e1', piece: { kind: 'king', colour: 'white' } },
      { square: 'h1', piece: { kind: 'rook', colour: 'white' } },
      { square: 'e8', piece: { kind: 'king', colour: 'black' } },
    ]), {
      castlingAvailability: {
        whiteKingSide: true,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
      },
    })

    const moves = GameRuleService.generateLegalMoves(position)
    expect(moves.some((move) => move.kind === 'castle' && move.to === 'g1')).toBe(true)
  })

  it('supports en passant generation and application', () => {
    const position = withPosition(createSparseBoard([
      { square: 'e5', piece: { kind: 'pawn', colour: 'white' } },
      { square: 'd5', piece: { kind: 'pawn', colour: 'black' } },
      { square: 'e1', piece: { kind: 'king', colour: 'white' } },
      { square: 'e8', piece: { kind: 'king', colour: 'black' } },
    ]), {
      sideToMove: 'white',
      enPassantTarget: 'd6',
    })

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.kind === 'enPassant')

    expect(move).toBeDefined()
    const nextPosition = GameRuleService.applyMove(position, move!)
    expect(nextPosition.piecesBySquare.d5).toBeUndefined()
    expect(nextPosition.piecesBySquare.d6).toEqual({ kind: 'pawn', colour: 'white' })
  })

  it('requires explicit promotion selection', () => {
    const position = createSparseBoard([
      { square: 'e7', piece: { kind: 'pawn', colour: 'white' } },
      { square: 'a1', piece: { kind: 'king', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ])

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.to === 'e8')!
    expect(GameRuleService.requiresPromotionSelection(position, move)).toBe(true)
    expect(() => GameRuleService.applyMove(position, move)).toThrow(/Promotion piece selection/)
  })

  it('resolves checkmate, stalemate, and insufficient material', () => {
    const checkmate = createSparseBoard([
      { square: 'f6', piece: { kind: 'king', colour: 'white' } },
      { square: 'g7', piece: { kind: 'queen', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ], 'black')

    const stalemate = createSparseBoard([
      { square: 'f7', piece: { kind: 'king', colour: 'white' } },
      { square: 'g6', piece: { kind: 'queen', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ], 'black')

    const insufficient = createSparseBoard([
      { square: 'a1', piece: { kind: 'king', colour: 'white' } },
      { square: 'h8', piece: { kind: 'king', colour: 'black' } },
    ])

    expect(GameRuleService.resolveResult(checkmate).resultState).toBe('whiteWon')
    expect(GameRuleService.resolveResult(stalemate).resultState).toBe('drawn')
    expect(GameRuleService.resolveResult(insufficient).resultState).toBe('drawn')
  })
})

