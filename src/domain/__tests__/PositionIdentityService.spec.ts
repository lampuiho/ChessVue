import { describe, expect, it } from 'vitest';

import { PieceKind, PlayerColour } from '@/contracts';
import { PositionIdentityService } from '..';
import { createSparseBoard } from '@/utility/chess';

const boardId = (file: number, rank: number) => file + (rank * 8);

describe('PositionIdentityService', () => {
  it('is stable for equal positions and changes when board state changes', () => {
    const first = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]);
    const same = createSparseBoard([
      { boardId: boardId(7, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
    ]);
    const changed = createSparseBoard([
      { boardId: boardId(0, 0), piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: boardId(6, 7), piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
    ]);

    expect(PositionIdentityService.buildPositionKey(first)).toBe(PositionIdentityService.buildPositionKey(same));
    expect(PositionIdentityService.buildPositionKey(first)).not.toBe(PositionIdentityService.buildPositionKey(changed));
  });
});
