import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { createTimedContext, clickSquare } from '../support/UiHarness';
describe('UI-01 and UI-16 immediate board and history feedback', () => {
  it('cancels repeated source selection and updates moves, branches and takeback immediately', async () => {
    const { game, games } = await createTimedContext();
    await clickSquare('e2');
    expect(document.querySelectorAll('.board-square--target').length).toBeGreaterThan(0);
    await clickSquare('e2');
    expect(document.querySelector('.board-square--selected')).toBeNull();
    expect(document.querySelector('.board-square--target')).toBeNull();
    await clickSquare('e2');
    await clickSquare('e4');
    expect(document.querySelectorAll('.history-row')).toHaveLength(1);
    await games.enterInGameAnalysis(game);
    await clickSquare('e7');
    await clickSquare('e5');
    expect(document.querySelectorAll('.history-row')).toHaveLength(2);
    games.exitInGameAnalysis(game);
    await games.takeBack(game);
    await nextTick();
    expect(document.querySelectorAll('.history-row')).toHaveLength(0);
  });
});
