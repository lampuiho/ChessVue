import { describe, expect, it, vi } from 'vitest';
import { PauseReason, type IGame } from '@/contracts';
import { boot, createTimedContext, legalMove } from '../support/UiHarness';
describe('JRN-CLOCK-04/10 restored pause ownership', () => {
  it('keeps the restored manual owner when a menu returns before the first resume', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { games } = await boot('clocks');
    const game = games.getGame('clocks-increment') as unknown as IGame;
    await games.pauseGame(game, PauseReason.Menu);
    await games.resumeGame(game, PauseReason.Menu);
    expect(game.$?.pauseReasons).toEqual([PauseReason.Manual]);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
  });
  it('restores paused analysis with only a manual owner and resumes actual play independently', async () => {
    const context = await createTimedContext();
    const { games, game, domain } = context;
    await games.enterInGameAnalysis(game);
    await games.pauseGame(game, PauseReason.Manual);
    const restored = await games.insertGame(domain.SerializationService.deserialiseGame(domain.SerializationService.serialiseGame(game)));
    expect(restored.$?.pauseReasons).toEqual([PauseReason.Manual]);
    await games.pauseGame(restored, PauseReason.Menu);
    await games.resumeGame(restored, PauseReason.Menu);
    expect(restored.clockSnapshot.white.isRunning).toBe(false);
    await games.resumeGame(restored, PauseReason.Manual);
    expect(restored.$?.pauseReasons).toEqual([]);
    await games.makeMove(restored, legalMove(context, restored, 'e2e4'));
    expect(restored.livePath).toEqual([]);
    expect(restored.clockSnapshot.white.isRunning).toBe(true);
    games.exitInGameAnalysis(restored);
    expect(restored.clockSnapshot.white.isRunning).toBe(true);
  });
});
