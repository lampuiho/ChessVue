import { test, expect } from './ClockTest';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { advanceClock, dismissTimeout, expectTimeout, openRunningClock, playerClock, selectClockGame } from './ClockAction';
for (const elapsed of [5000, 125000]) {
  test(`JRN-CLOCK-09 reconciles ${elapsed}ms of hidden time on visibility and focus return`, async ({ page }) => {
    await openRunningClock(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const now = await page.evaluate(() => Date.now());
    // Change wall time without delivering the missed UI intervals.
    await page.clock.setFixedTime(new Date(now + elapsed));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.clock.runFor(250);
    if (elapsed > 120000) {
      await expectTimeout(page);
      await expect(playerClock(page, 'white')).toHaveText('0:00.0');
      await dismissTimeout(page);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.clock.runFor(1000);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else {
      await expect(playerClock(page, 'white')).toHaveText('1:55');
      await playMove(page, 'g1', 'f3');
      expect((await saveCurrentGame(page, 'focus-return')).clockSnapshot.white.remainingMs).toBe(117000);
    }
  });
}
test('JRN-CLOCK-11 keeps the first game clock running while another game tab is selected', async ({ page }) => {
  await openRunningClock(page);
  await page.locator('.game-page').evaluate((element) => element.setAttribute('data-clock-instance', 'retained'));
  await selectClockGame(page, 'Timeout B');
  await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
  await advanceClock(page, 5000);
  await selectClockGame(page, 'Two-minute clock + 2 seconds');
  await expect(page.locator('.game-page')).toHaveAttribute('data-clock-instance', 'retained');
  await expect(playerClock(page, 'white')).toHaveText('1:55');
  await expect(playerClock(page, 'white')).toHaveClass(/player-clock--running/);
  await playMove(page, 'g1', 'f3');
  expect((await saveCurrentGame(page, 'tab-return')).clockSnapshot.white.remainingMs).toBe(117000);
  await selectClockGame(page, 'Timeout B');
  await expect(playerClock(page, 'white')).toHaveText('0:03.0');
});
