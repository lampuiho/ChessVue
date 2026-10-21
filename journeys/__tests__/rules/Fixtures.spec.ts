import { describe, expect, it } from 'vitest';
import { PieceKind, PlayerColour, ResultState, type IBoardPosition, type IMoveNode } from '@/contracts';
import { SerializationService } from '@/domain/SerializationService';
import { applyMove, genLegalMoves, getCheckState, getOpponentColour, isMoveLegal, resolveGameResult } from '@/utility/chess';
import { createJourney } from '../../index';
import { createRuleVariants } from '../../definitions/rules/data/RuleWorkspace';
function _validateTree(position: IBoardPosition, node: IMoveNode) {
  for (const child of node.children) {
    expect(isMoveLegal(position, child.move!)).toBe(true);
    const next = structuredClone(position);
    applyMove(next, child.move!);
    _validateTree(next, child);
  }
}
describe('Rules fixture contracts', () => {
  it.each(createRuleVariants(1000).map((game) => [game.metadata.id, game] as const))('%s has a legal ongoing root, legal history and canonical round trip', (id, game) => {
    for (const colour of [PlayerColour.White, PlayerColour.Black]) expect(game.rootPosition.board.filter((piece) => piece?.kind === PieceKind.King && piece.colour === colour)).toHaveLength(1);
    expect(getCheckState({ ...structuredClone(game.rootPosition), sideToMove: getOpponentColour(game.rootPosition.sideToMove) })).toBeUndefined();
    expect(resolveGameResult(game.rootPosition).resultState).toBe(ResultState.Ongoing);
    expect(genLegalMoves(game.rootPosition).length).toBeGreaterThan(0);
    _validateTree(game.rootPosition, game.moveTree.root);
    const raw = SerializationService.serialiseGame(game);
    expect(raw).not.toContain('"$"');
    expect(SerializationService.serialiseGame(SerializationService.deserialiseGame(raw))).toBe(raw);
    expect(createJourney('rules', 1000, id.replace('rules-', '')).gameIds).toEqual([id]);
  });
  it('keeps the four default tabs stable and rejects misspelt variants', () => {
    expect(createJourney('rules', 1000).gameIds).toEqual(['rules-castle-white', 'rules-en-passant-white', 'rules-castle-black', 'rules-en-passant-black']);
    expect(() => createJourney('rules', 1000, 'unknown')).toThrow('Unknown rules variant');
  });
});
