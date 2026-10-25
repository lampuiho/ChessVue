import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { GameState, type IGame } from '@/contracts';
import { boot, clickButton, setField } from '../support/UiHarness';

async function _submitStart() {
  document.querySelector<HTMLFormElement>('#new-game-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flushPromises();
}
describe('JRN-SETUP-07/08 start transition', () => {
  it('UI-10 and UI-17 locks setup controls and starts with validated options from the edited board', async () => {
    const { games, router } = await boot('setup');
    await clickButton('Edit board', '.control-button');
    expect([...document.querySelectorAll<HTMLButtonElement>('.history-row')].every((button) => button.disabled)).toBe(true);
    const game = games.getGame('setup-board') as unknown as IGame;
    await router.push('/game/setup-board');
    await flushPromises();
    expect([...document.querySelectorAll<HTMLButtonElement>('.player-name')].every((button) => button.disabled)).toBe(true);
    expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow('editing');
    await clickButton('Finish editing', '.control-button');
    const board = JSON.stringify(game.rootPosition.board);
    await clickButton('Start game', '.control-button');
    setField('#time-preset', 'custom');
    await nextTick();
    setField('input[type="number"]', '9');
    setField('.time-fields label:nth-child(2) input', '2');
    setField('#new-game-form .form-section:last-child .toggle-row input', false);
    setField('.toggle-row:nth-of-type(2) input', true);
    await nextTick();
    await _submitStart();
    expect(JSON.stringify(game.rootPosition.board)).toBe(board);
    expect(game.timeControl).toEqual({ initialMs: 540000, incrementMs: 2000 });
    expect(game.gameplayOptions).toEqual({ allowTakeback: false, showLiveAnalysisMoves: true });
    expect(game.livePath).toEqual([]);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
  });
  it('leaves all setup fields untouched on failed validation and starts one due engine turn on retry', async () => {
    const { games, domain } = await boot('setup');
    const game = games.getGame('setup-analysis') as unknown as IGame;
    const before = JSON.parse(domain.SerializationService.serialiseGame(game));
    const turn = vi.spyOn(domain.EngineRuntimeService, 'startPlayerTurn');
    await clickButton('Start game', '.control-button');
    setField('#game-name', 'Retry start');
    setField('#time-preset', 'custom');
    await nextTick();
    setField('input[type="number"]', '9');
    setField('.time-fields label:nth-child(2) input', '2');
    setField('#black-player', 'engine:journey-unavailable');
    await nextTick();
    await _submitStart();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('unavailable'));
    expect(JSON.parse(domain.SerializationService.serialiseGame(game))).toEqual(before);
    expect(turn).not.toHaveBeenCalled();
    setField('#black-player', 'engine:journey-a');
    await nextTick();
    await _submitStart();
    await vi.waitFor(() => expect(game.livePath).toHaveLength(4));
    await flushPromises();
    expect(turn).toHaveBeenCalledTimes(1);
    expect(games.listGames()).toHaveLength(2);
    expect(game.metadata.name).toBe('Retry start');
    expect(game.rootPosition.board).toEqual(before.rootPosition.board.map((piece: unknown) => piece ?? undefined));
    expect(game.moveTree.root.children[0]!.children[0]!.children[0]!.children).toHaveLength(1);
  });
});
