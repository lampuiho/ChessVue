import { describe, expect, it, vi } from 'vitest';
import { ResultReason, ResultState } from '@/contracts';
import { clickButton, createTimedContext, legalMove } from '../support/UiHarness';
describe('JRN-CLOCK-07/08 original UI-06 timeout regressions', () => {
  it('adjudicates another timeout after reopening the same game with takeback', async () => {
    const context = await createTimedContext();
    const { game, games, stores } = context;
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    await vi.advanceTimersByTimeAsync(3250);
    expect(game.resultState).toBe(ResultState.WhiteWon);
    expect(game.resultReason).toBe(ResultReason.Timeout);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Time has expired');
    await clickButton('Review game', '[role="dialog"] button');
    await games.takeBack(game);
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(3250);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.resultReason).toBe(ResultReason.Timeout);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Time has expired');
  });
  it('shows another timeout after changing the selected game in the mounted view', async () => {
    const { game, games, stores, router } = await createTimedContext();
    await vi.advanceTimersByTimeAsync(3250);
    expect(game.resultReason).toBe(ResultReason.Timeout);
    await clickButton('Review game', '[role="dialog"] button');
    const second = await games.createGame({ name: 'Second timed tab', whitePlayer: game.whitePlayer, blackPlayer: game.blackPlayer, timeControl: { ...game.timeControl }, analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: false });
    stores.useUiStateStore().openTab(second.metadata.id);
    await router.push('/game/' + second.metadata.id);
    await vi.advanceTimersByTimeAsync(3250);
    expect(second.resultReason).toBe(ResultReason.Timeout);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Black wins on time.');
  });
});
