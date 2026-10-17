import { test, expect } from './ClockTest';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { advanceClock, openRunningClock, playerClock, resumeClock } from './ClockAction';
for (const colour of ['white', 'black'] as const) {
  test(`JRN-CLOCK-02 freezes ${colour} and blocks gameplay until its eligible clock resumes`, async ({ page }) => {
    await openRunningClock(page);
    if (colour === 'black') await playMove(page, 'g1', 'f3');
    await advanceClock(page, 1000);
    await page.getByRole('button', { name: /^Pause Stop/ }).click();
    const before = await saveCurrentGame(page, 'paused-before');
    await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
    await expect(square(page, colour === 'white' ? 'g1' : 'b8')).toBeDisabled();
    await square(page, colour === 'white' ? 'g1' : 'b8').click({ force: true });
    await expect(page.getByRole('button', { name: 'Start position', exact: true })).toBeDisabled();
    await expect(page.locator('.history-row').first()).toBeDisabled();
    for (const name of [/^Takeback/, /^Resign$/, /^Offer draw$/]) await expect(page.getByRole('button', { name })).toHaveCount(0);
    await advanceClock(page, 60000);
    const after = await saveCurrentGame(page, 'paused-after');
    for (const field of ['clockSnapshot', 'moveTree', 'livePath', 'renderedPath', 'resultState'] as const) expect(after[field]).toEqual(before[field]);
    await resumeClock(page);
    await advanceClock(page, 1000);
    await expect(playerClock(page, colour)).toHaveText('1:58');
    await expect(playerClock(page, colour)).toHaveClass(/player-clock--running/);
    await expect(playerClock(page, colour === 'white' ? 'black' : 'white')).not.toHaveClass(/player-clock--running/);
    await playMove(page, colour === 'white' ? 'g1' : 'b8', colour === 'white' ? 'f3' : 'c6');
    const moved = await saveCurrentGame(page, 'resumed-move');
    expect(moved.livePath).toHaveLength(before.livePath!.length + 1);
  });
}
