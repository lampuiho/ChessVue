import { describe, expect, it } from 'vitest';
import { PauseReason } from '@/contracts';
import { createTimedContext, legalMove } from '../support/UiHarness';

describe('JRN-HIST-07 independent pause ownership', () => {
  for (const reason of [PauseReason.Manual, PauseReason.Menu]) {
    it(`keeps ${reason} in force when analysis exits first`, async () => {
      const context = await createTimedContext();
      const { games, game } = context;
      await games.enterInGameAnalysis(game);
      await games.pauseGame(game, reason);
      games.exitInGameAnalysis(game);
      expect(game.$?.pauseReasons).toEqual([reason]);
      expect(game.clockSnapshot.white.isRunning).toBe(false);
      await expect(games.makeMove(game, legalMove(context, game, 'e2e4'))).rejects.toThrow();
      expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow();
      await games.resumeGame(game, reason);
      expect(game.clockSnapshot.white.isRunning).toBe(true);
      expect(game.$?.pauseReasons).toEqual([]);
    });
  }
  it('retains manual and analysis ownership after removing only a menu pause', async () => {
    const context = await createTimedContext();
    const { games, game } = context;
    await games.enterInGameAnalysis(game);
    await games.pauseGame(game, PauseReason.Manual);
    await games.pauseGame(game, PauseReason.Menu);
    await games.resumeGame(game, PauseReason.Menu);
    expect(game.$?.pauseReasons).toEqual([PauseReason.Analysis, PauseReason.Manual]);
    await expect(games.makeMove(game, legalMove(context, game, 'e2e4'))).rejects.toThrow();
    await games.resumeGame(game, PauseReason.Manual);
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    games.exitInGameAnalysis(game);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
  });
});
