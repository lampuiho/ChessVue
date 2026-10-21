import { describe, expect, it } from 'vitest';

import { PieceKind, PlayerColour } from '@/contracts';
import { PositionIdentityService } from '..';
import { createSparseBoard } from '@/utility/chess';

const _boardId = (file: number, rank: number) => file + (rank * 8);

describe('PositionIdentityService', () => {
  it('is stable for equal positions and changes when board state changes', () => {
    const first = createSparseBoard([
      { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]);
    const same = createSparseBoard([
      { boardId: _boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
    ]);
    const changed = createSparseBoard([
      { boardId: _boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: _boardId(6, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]);

    expect(PositionIdentityService.buildPositionKey(first)).toBe(PositionIdentityService.buildPositionKey(same));
    expect(PositionIdentityService.buildPositionKey(first)).not.toBe(PositionIdentityService.buildPositionKey(changed));
  });
});
