import { describe, expect, it } from 'vitest';

import { MoveKind, PieceKind, PlayerColour, ResultState, type IBoardPosition } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard, GameRuleService, normaliseBoardPosition, } from '..';

const boardId = (file: number, rank: number) => file + (rank * 8);

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
      { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(4, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(4, 7), piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    const illegalMove = {
      from: boardId(4, 1),
      to: boardId(5, 1),
      kind: MoveKind.Normal,
      movingColour: PlayerColour.White,
      promotionPiece: null,
    }

    expect(GameRuleService.isMoveLegal(position, illegalMove)).toBe(false)
  })

  it('allows legal castling when the path is clear and safe', () => {
    const position = withPosition(createSparseBoard([
      { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 0), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]), {
      castlingAvailability: {
        whiteKingSide: true,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
      },
    })

    const moves = GameRuleService.generateLegalMoves(position)
    expect(moves.some((move) => move.kind === MoveKind.Castle && move.to === boardId(6, 0))).toBe(true)
  })

  it('supports en passant generation and application', () => {
    const position = withPosition(createSparseBoard([
      { boardId: boardId(4, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { boardId: boardId(3, 4), piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
      { boardId: boardId(4, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(4, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]), {
      sideToMove: PlayerColour.White,
      enPassantTarget: boardId(3, 5),
    })

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.kind === MoveKind.EnPassant)

    expect(move).toBeDefined()
    const nextPosition = GameRuleService.applyMove(position, move!)
    expect(nextPosition.board[boardId(3, 4)]).toBeUndefined()
    expect(nextPosition.board[boardId(3, 5)]).toEqual({ kind: PieceKind.Pawn, colour: PlayerColour.White })
  })

  it('requires explicit promotion selection', () => {
    const position = createSparseBoard([
      { boardId: boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    const move = GameRuleService.generateLegalMoves(position).find((candidate) => candidate.to === boardId(4, 7))!
    expect(GameRuleService.requiresPromotionSelection(position, move)).toBe(true)
    expect(() => GameRuleService.applyMove(position, move)).toThrow(/Promotion piece selection/)
  })

  it('resolves checkmate, stalemate, and insufficient material', () => {
    const checkmate = createSparseBoard([
      { boardId: boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(6, 6), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.Black)

    const stalemate = createSparseBoard([
      { boardId: boardId(5, 6), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(6, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.Black)

    const insufficient = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    expect(GameRuleService.resolveResult(checkmate).resultState).toBe(ResultState.WhiteWon)
    expect(GameRuleService.resolveResult(stalemate).resultState).toBe(ResultState.Drawn)
    expect(GameRuleService.resolveResult(insufficient).resultState).toBe(ResultState.Drawn)
  })
})
