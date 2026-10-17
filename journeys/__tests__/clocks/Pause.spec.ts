import { describe, expect, it, vi } from 'vitest';
import { GameState, PauseReason, PlayerColour, type IGame } from '@/contracts';
import { boot, createTimedContext, legalMove } from '../support/UiHarness';
describe('JRN-CLOCK-02/04/12 pause boundaries', () => {
  it('arms exactly one player turn when a persisted paused clock resumes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const context = await boot('clocks');
    const game = context.games.getGame('clocks-increment') as unknown as IGame;
    expect(game.$?.pendingPlayerTurnPromise).toBeUndefined();
    await context.games.resumeGame(game, PauseReason.Manual);
    const pending = game.$?.pendingPlayerTurnPromise;
    expect(pending).toBeDefined();
    await context.games.resumeGame(game, PauseReason.Manual);
    expect(game.$?.pendingPlayerTurnPromise).toBe(pending);
    await context.games.makeMove(game, legalMove(context, game, 'g1f3'));
    expect(game.livePath).toEqual([0, 0, 0]);
    expect(game.clockSnapshot.white.remainingMs).toBe(122000);
    expect(game.clockSnapshot.activeColour).toBe(PlayerColour.Black);
  }, 30000); // Cold app compilation; UiHarness still requires readiness within five seconds.
  it('rejects every paused gameplay action without changing canonical data', async () => {
    const context = await createTimedContext();
    const { games, game, domain } = context;
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    await games.pauseGame(game, PauseReason.Manual);
    const before = domain.SerializationService.serialiseGame(game);
    await expect(games.makeMove(game, legalMove(context, game, 'e7e5'))).rejects.toThrow('not allowed');
    expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow('not allowed');
    await expect(games.takeBack(game)).rejects.toThrow('not allowed');
    await expect(games.resignGame(game, PlayerColour.Black)).rejects.toThrow('not allowed');
    await expect(games.offerDraw(game)).rejects.toThrow('not allowed');
    await expect(games.acceptDrawOffer(game)).rejects.toThrow('not allowed');
    await expect(games.withdrawDrawOffer(game)).rejects.toThrow('not allowed');
    expect(domain.SerializationService.serialiseGame(game)).toBe(before);
  });
  it('deduplicates repeated pause owners and removes only the named owner', async () => {
    const { games, game } = await createTimedContext();
    await games.enterInGameAnalysis(game);
    const snapshot = game.clockSnapshot;
    for (const reason of [PauseReason.Manual, PauseReason.Menu, PauseReason.Manual, PauseReason.Menu]) await games.pauseGame(game, reason);
    expect(game.$?.pauseReasons).toEqual([PauseReason.Analysis, PauseReason.Manual, PauseReason.Menu]);
    vi.setSystemTime(Date.now() + 60000);
    await games.resumeGame(game, PauseReason.Menu);
    await games.resumeGame(game, PauseReason.Menu);
    expect(game.$?.pauseReasons).toEqual([PauseReason.Analysis, PauseReason.Manual]);
    expect(game.clockSnapshot).toBe(snapshot);
    await games.resumeGame(game, PauseReason.Manual);
    expect(game.$?.pauseReasons).toEqual([PauseReason.Analysis]);
    expect(game.clockSnapshot).toBe(snapshot);
    games.exitInGameAnalysis(game);
    expect(game.$?.pauseReasons).toEqual([]);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.clockSnapshot.white).toEqual({ remainingMs: 3000, isRunning: true });
  });
});
