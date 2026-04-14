import { describe, expect, it } from 'vitest'

import { MoveKind, PieceKind, PlayerColour, type IMove } from '@/contracts'
import { MoveNotationService, PositionIdentityService } from '..'
import { createSparseBoard, normaliseBoardPosition } from '@/utility/chess'

const boardId = (file: number, rank: number) => file + (rank * 8);

describe('MoveNotationService', () => {
  it('builds SAN for castling, captures, promotion, check, and mate', () => {
    const castlePosition = normaliseBoardPosition({
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
    })
    const castleMove: IMove = { from: boardId(4, 0), to: boardId(6, 0), kind: MoveKind.Castle, movingColour: PlayerColour.White }
    expect(MoveNotationService.buildSan(castlePosition, castleMove)).toBe('O-O')

    const capturePosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(3, 3), piece: { kind: PieceKind.Bishop, colour: PlayerColour.White } },
      { boardId: boardId(6, 6), piece: { kind: PieceKind.Knight, colour: PlayerColour.Black } },
      { boardId: boardId(0, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White)
    const captureMove: IMove = { from: boardId(3, 3), to: boardId(6, 6), kind: MoveKind.Normal, movingColour: PlayerColour.White }
    expect(MoveNotationService.buildSan(capturePosition, captureMove)).toBe('Bxg7')

    const promotionPosition = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(4, 6), piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White)
    const promotionMove: IMove = { from: boardId(4, 6), to: boardId(4, 7), kind: MoveKind.Promotion, movingColour: PlayerColour.White, promotionPiece: PieceKind.Queen }
    expect(MoveNotationService.buildSan(promotionPosition, promotionMove)).toBe('e8=Q+')

    const matePosition = createSparseBoard([
      { boardId: boardId(5, 5), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 5), piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White)
    const mateMove: IMove = { from: boardId(7, 5), to: boardId(6, 6), kind: MoveKind.Normal, movingColour: PlayerColour.White }
    expect(MoveNotationService.buildSan(matePosition, mateMove)).toBe('Qg7#')
  })

  it('builds SAN disambiguation and runtime decoration', () => {
    const position = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(0, 1), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(0, 3), piece: { kind: PieceKind.Rook, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ], PlayerColour.White)
    const move: IMove = { from: boardId(0, 1), to: boardId(0, 2), kind: MoveKind.Normal, movingColour: PlayerColour.White }
    const decoratedMove = MoveNotationService.decorateMove(position, move)

    expect(MoveNotationService.buildSan(position, move)).toBe('R2a3')
    expect(decoratedMove.$).toEqual({
      san: 'R2a3',
      uci: 'a2a3',
    })
  })
})

describe('PositionIdentityService', () => {
  it('is stable for equal positions and changes when board state changes', () => {
    const first = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])
    const same = createSparseBoard([
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
    ])
    const changed = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(6, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ])

    expect(PositionIdentityService.buildPositionKey(first)).toBe(PositionIdentityService.buildPositionKey(same))
    expect(PositionIdentityService.buildPositionKey(first)).not.toBe(PositionIdentityService.buildPositionKey(changed))
  })
})
