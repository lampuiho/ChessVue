import { test, expect } from './ClockTest';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { readGame } from '../../support/SaveInspection';
import { advanceClock, disableMenuPause, dismissTimeout, expectTimeout, openRunningClock, playerClock, resumeClock } from './ClockAction';
for (const policy of ['running', 'paused', 'expired'] as const) {
  test(`JRN-CLOCK-10 restores ${policy} timed save using its persisted timestamps`, async ({ page }) => {
    await openRunningClock(page);
    await disableMenuPause(page);
    await advanceClock(page, 1000);
    if (policy === 'paused') await page.getByRole('button', { name: /^Pause Stop/ }).click();
    const saved = await saveCurrentGame(page, 'clock-restore');
    const now = await page.evaluate(() => Date.now());
    await page.clock.setFixedTime(new Date(now + (policy === 'expired' ? 125000 : 30000)));
    await page.reload();
    await waitForJourney(page);
    await page.clock.runFor(250);
    expect((await readGame(page, 'saves/clocks-increment/clock-restore.json')).clockSnapshot).toEqual(saved.clockSnapshot);
    if (policy === 'expired') {
      await expectTimeout(page);
      await dismissTimeout(page);
      const expired = await saveCurrentGame(page, 'restored-expiry');
      expect(expired.resultState).toBe('blackWon');
      expect(expired.clockSnapshot.white.remainingMs).toBe(0);
      expect(expired.livePath).toEqual(saved.livePath);
      return;
    }
    await expect(playerClock(page, 'white')).toHaveText(policy === 'paused' ? '1:59' : '1:29');
    if (policy === 'paused') {
      await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
      await advanceClock(page, 10000);
      await expect(playerClock(page, 'white')).toHaveText('1:59');
      await resumeClock(page);
    }
    await playMove(page, 'g1', 'f3');
    const after = await saveCurrentGame(page, 'continued-restore');
    expect(after.clockSnapshot.white.remainingMs).toBe(policy === 'paused' ? 121000 : 91000);
    expect(after.clockSnapshot.black.isRunning).toBe(true);
    expect(after.livePath).toEqual([0, 0, 0]);
  });
}
test('JRN-CLOCK-10 restores analysis pause until explicit resume and exit without charging hidden time', async ({ page }) => {
  await openRunningClock(page);
  await advanceClock(page, 1000);
  await page.getByRole('button', { name: /^Analyse Explore/ }).click();
  await saveCurrentGame(page, 'analysis-restore');
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(new Date(now + 60000));
  await page.reload();
  await waitForJourney(page);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Resume game/ }).click();
  await expect(page.getByRole('heading', { name: 'Analysis mode', exact: true })).toBeVisible();
  await advanceClock(page, 10000);
  await expect(playerClock(page, 'white')).toHaveText('1:59');
  await playMove(page, 'g1', 'f3');
  expect((await saveCurrentGame(page, 'restored-exploration')).livePath).toEqual([0, 0]);
  await page.getByRole('button', { name: /^Exit analysis/ }).click();
  await playMove(page, 'g1', 'f3');
  const saved = await saveCurrentGame(page, 'restored-live');
  expect(saved.clockSnapshot.white.remainingMs).toBe(121000);
  expect(saved.livePath).toEqual([0, 0, 0]);
});
