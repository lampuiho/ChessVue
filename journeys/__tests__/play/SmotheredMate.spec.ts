import { describe, expect, it } from 'vitest';
import { PlayerColour } from '@/contracts';
import { applyMove, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';
import { createSmotheredMate, smotheredMateLine } from '../../definitions/play/data/SmotheredMate';

describe('smothered mate puzzle', () => {
  it('has a legal mate-in-three line with forced black replies', () => {
    const position = createSmotheredMate().rootPosition;
    for (const uci of smotheredMateLine) {
      const legal = genLegalMoves(position);
      if (position.sideToMove === PlayerColour.Black) expect(legal.map(getUci)).toEqual([uci]);
      const raw = legal.find((move) => getUci(move) === uci);
      expect(raw).toBeDefined();
      const move = toDetailedMove(position, raw!);
      if (uci === smotheredMateLine.at(-1)) expect(move.checkState).toBe('checkmate');
      applyMove(position, move);
    }
    expect(genLegalMoves(position)).toHaveLength(0);
  });
});
