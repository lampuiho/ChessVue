import { test, expect } from './ClockTest';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { advanceClock, openRunningClock, playerClock, disableMenuPause, resumeClock } from './ClockAction';
test('JRN-CLOCK-01 awards exactly one two-second increment and starts Black after Nf3', async ({ page }) => {
  await openRunningClock(page);
  await disableMenuPause(page);
  await advanceClock(page, 1000);
  await playMove(page, 'g1', 'f3');
  await expect(playerClock(page, 'white')).toHaveText('2:01');
  await expect(playerClock(page, 'black')).toHaveClass(/player-clock--running/);
  await advanceClock(page, 1000);
  const saved = await saveCurrentGame(page, 'increment');
  expect(saved.clockSnapshot.white).toEqual({ remainingMs: 121000, isRunning: false });
  expect(saved.clockSnapshot.activeColour).toBe('black');
  expect(saved.clockSnapshot.black.isRunning).toBe(true);
  expect(saved.livePath).toEqual([0, 0, 0]);
  await expect(playerClock(page, 'black')).toHaveText('1:59');
});
for (const increment of [0, 2000]) {
  test(`JRN-CLOCK-12 preserves time and awards one increment after repeated pauses with ${increment}ms increment`, async ({ page }) => {
    await openRunningClock(page, increment ? 'Two-minute clock + 2 seconds' : 'Timeout A');
    await disableMenuPause(page);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await advanceClock(page, 250);
      await page.getByRole('button', { name: /^Pause Stop/ }).click();
      await advanceClock(page, 10000);
      await resumeClock(page);
    }
    await playMove(page, increment ? 'g1' : 'e2', increment ? 'f3' : 'e4');
    const saved = await saveCurrentGame(page, 'cycles');
    expect(saved.clockSnapshot.white.remainingMs).toBe((increment ? 120000 : 3000) - 750 + increment);
    expect(saved.clockSnapshot.black.isRunning).toBe(true);
    expect(saved.clockSnapshot.activeColour).toBe('black');
    expect(saved.livePath).toHaveLength(increment ? 3 : 1);
  });
}
