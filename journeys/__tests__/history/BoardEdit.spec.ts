import { describe, expect, it } from 'vitest';
import { PlayerColour, type IGame } from '@/contracts';
import { boot } from '../support/UiHarness';

describe('JRN-HIST-08 board-edit guard', () => {
  for (const mode of ['analysis', 'finished']) {
    it(`rejects direct board editing in a ${mode} live-game workspace`, async () => {
      const { games, domain } = await boot('history');
      const game = games.getGame('history-allowed') as unknown as IGame;
      if (mode === 'analysis') await games.enterInGameAnalysis(game);
      else await games.resignGame(game, PlayerColour.White);
      const before = domain.SerializationService.serialiseGame(game);
      try { games.enterBoardEdit(game); } catch (error) { expect(String(error)).toContain('not allowed'); }
      expect(() => games.clearBoard(game)).toThrow();
      expect(domain.SerializationService.serialiseGame(game)).toBe(before);
    });
  }
});
