import { describe, expect, it } from 'vitest';
import type { IGame } from '@/contracts';
import { boot } from '../support/UiHarness';

describe('JRN-HIST-09 stale navigation', () => {
  it('ignores a detached child even when its old parent reference survives', async () => {
    const { games, domain } = await boot('history');
    const game = games.getGame('history-allowed') as unknown as IGame;
    const parent = game.moveTree.root.children[0]!;
    const detached = parent.children.splice(1, 1)[0]!;
    expect(detached.$?.parent).toBe(parent);
    const before = domain.SerializationService.serialiseGame(game);
    expect(() => games.navigateToNode(game, detached)).not.toThrow();
    expect(domain.SerializationService.serialiseGame(game)).toBe(before);
  });
  it('ignores descendants pruned from a branch and nodes belonging to another hydrated game', async () => {
    const { games, domain } = await boot('history');
    const game = games.getGame('history-allowed') as unknown as IGame;
    const branch = game.moveTree.root.children[0]!.children[1]!;
    const stale = branch.children[0]!.children[0]!;
    domain.MoveHistoryService.pruneFutureMoves(branch);
    const before = domain.SerializationService.serialiseGame(game);
    const other = games.getGame('history-blocked') as unknown as IGame;
    for (const node of [stale, other.moveTree.root.children[0]!]) {
      expect(() => games.navigateToNode(game, node)).not.toThrow();
      expect(domain.SerializationService.serialiseGame(game)).toBe(before);
    }
  });
});
