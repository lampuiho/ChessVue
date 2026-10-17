import { test, expect } from './ClockTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { clockMenus, pauseOwners } from '../../../journeys/definitions/clocks/data/ClockScenario';
import { advanceClock, closeClockMenu, createUntimedClock, disableMenuPause, openClockMenu, openRunningClock, playerClock, resumeClock } from './ClockAction';
for (const menu of clockMenus) {
  test(`JRN-CLOCK-03 freezes a running clock during ${menu} and resumes on return @smoke`, async ({ page }) => {
    await openRunningClock(page);
    await advanceClock(page, 1000);
    await openClockMenu(page, menu);
    await advanceClock(page, 30000);
    await closeClockMenu(page, menu);
    await expect(playerClock(page, 'white')).toHaveText('1:59');
    await expect(playerClock(page, 'white')).toHaveClass(/player-clock--running/);
    await advanceClock(page, 1000);
    await expect(playerClock(page, 'white')).toHaveText('1:58');
    await playMove(page, 'g1', 'f3');
    expect((await saveCurrentGame(page, 'menu-return')).clockSnapshot.white.remainingMs).toBe(120000);
  });
  for (const owner of pauseOwners) {
    test(`JRN-CLOCK-04 preserves ${owner} ownership through ${menu} return`, async ({ page }) => {
      await openJourney(page, 'clocks');
      if (owner !== 'restored manual') {
        await resumeClock(page);
        await advanceClock(page, 1000);
        await page.getByRole('button', { name: owner === 'manual' ? /^Pause Stop/ : /^Analyse Explore/ }).click();
      }
      await openClockMenu(page, menu);
      await advanceClock(page, 30000);
      await closeClockMenu(page, menu);
      await expect(page.getByRole('heading', { name: owner === 'analysis' ? 'Analysis mode' : 'Game paused', exact: true })).toBeVisible();
      await expect(playerClock(page, 'white')).toHaveText(owner === 'restored manual' ? '2:00' : '1:59');
      await expect(playerClock(page, 'white')).not.toHaveClass(/player-clock--running/);
      if (owner !== 'analysis') await expect(square(page, 'g1')).toBeDisabled();
      else {
        await playMove(page, 'g1', 'f3');
        expect((await saveCurrentGame(page, 'analysis-owned')).livePath).toEqual([0, 0]);
      }
      await advanceClock(page, 10000);
      await expect(playerClock(page, 'white')).toHaveText(owner === 'restored manual' ? '2:00' : '1:59');
      if (owner !== 'analysis') await resumeClock(page);
      else await page.getByRole('button', { name: /^Exit analysis/ }).click();
      await advanceClock(page, 1000);
      await expect(playerClock(page, 'white')).toHaveText(owner === 'restored manual' ? '1:59' : '1:58');
    });
  }
  test(`JRN-CLOCK-05 keeps time running through ${menu} when menu pause is disabled`, async ({ page }) => {
    await openJourney(page, 'clocks');
    await disableMenuPause(page);
    await resumeClock(page);
    await openClockMenu(page, menu);
    await advanceClock(page, 5000);
    await closeClockMenu(page, menu);
    await expect(playerClock(page, 'white')).toHaveText('1:55');
    await expect(playerClock(page, 'white')).toHaveClass(/player-clock--running/);
    await expect(page.getByRole('heading', { name: 'Game controls', exact: true })).toBeVisible();
  });
  test(`JRN-CLOCK-05 leaves an untimed game playable after ${menu}`, async ({ page }) => {
    await openJourney(page, 'clocks');
    await createUntimedClock(page);
    await openClockMenu(page, menu);
    await advanceClock(page, 60000);
    await closeClockMenu(page, menu);
    await expect(page.getByRole('heading', { name: 'Game controls', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resume game|^Pause Stop/ })).toHaveCount(0);
    await expect(page.locator('.player-clock--untimed')).toHaveCount(2);
    await playMove(page, 'e2', 'e4');
    const saved = await saveCurrentGame(page, 'untimed');
    expect(saved.livePath).toEqual([0]);
    expect(saved.clockSnapshot.white).toEqual({ isRunning: false });
    expect(saved.clockSnapshot.black).toEqual({ isRunning: false });
  });
}
