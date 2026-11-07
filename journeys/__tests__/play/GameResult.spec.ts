import { describe, expect, it, vi } from 'vitest';
import { PlayerColour, ResultReason, ResultState } from '@/contracts';
import { createTimedContext, dismissGameResult, legalMove } from '../support/UiHarness';
function _dialogText() {
  return document.querySelector('[role=dialog]')?.textContent ?? '';
}
describe('game-end announcement', () => {
  it('announces a resignation that would otherwise finish in silence', async () => {
    const { game, games } = await createTimedContext();
    await games.resignGame(game, PlayerColour.White);
    await vi.advanceTimersByTimeAsync(250);
    expect(_dialogText()).toContain('Black wins by resignation.');
    expect(game.$?.resultNotificationPending).toBe(false);
  });
  it('announces an agreed draw', async () => {
    const { game, games } = await createTimedContext();
    await games.offerDraw(game);
    await games.acceptDrawOffer(game);
    await vi.advanceTimersByTimeAsync(250);
    expect(_dialogText()).toContain('Draw by agreement.');
  });
  it('announces a checkmate delivered on the board', async () => {
    const context = await createTimedContext();
    const { game, games } = context;
    for (const uci of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) await games.makeMove(game, legalMove(context, game, uci));
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.resultReason).toBe(ResultReason.Checkmate);
    await vi.advanceTimersByTimeAsync(250);
    expect(_dialogText()).toContain('Black wins by checkmate.');
  });
  it('stays silent when a game that was already finished is restored into the workspace', async () => {
    const context = await createTimedContext();
    const { game, games, stores, router, domain } = context;
    await games.resignGame(game, PlayerColour.White);
    await vi.advanceTimersByTimeAsync(250);
    await dismissGameResult();
    const restored = domain.SerializationService.deserialiseGame(domain.SerializationService.serialiseGame(game));
    restored.metadata.id = 'restored-finished-game';
    await games.insertGame(restored);
    stores.useUiStateStore().openTab(restored.metadata.id);
    await router.push('/game/' + restored.metadata.id);
    await vi.advanceTimersByTimeAsync(1000);
    expect(restored.$?.resultNotificationPending).toBeUndefined();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
