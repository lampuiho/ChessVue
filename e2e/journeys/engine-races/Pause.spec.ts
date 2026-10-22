import { test, expect } from './RaceTest';
import { openRace, heldPlayer, release, playerSearchCount } from './RaceAction';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
for (const interruption of ['manual', 'menu', 'layered'] as const) {
  test(`JRN-RACE-01 defers a held reply across ${interruption} pause and commits once`, async ({ page }) => {
    await openRace(page);
    const search = await heldPlayer(page);
    if (interruption !== 'menu') await page.getByRole('button', { name: /^Pause/ }).click();
    if (interruption !== 'manual') await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await release(page, search.id);
    if (interruption !== 'manual') await page.getByRole('button', { name: 'Back to game', exact: true }).click();
    if (interruption !== 'menu') {
      await expect(page.locator('.history-row')).toHaveCount(1);
      await expect(square(page, 'e4')).toHaveAttribute('aria-label', 'e4 white pawn');
      const paused = await saveCurrentGame(page, 'paused-reply');
      expect(paused.livePath).toEqual([0]);
      expect(paused.clockSnapshot.black.remainingMs).toBe(60000);
      await page.getByRole('button', { name: /^Resume game/ }).click();
    }
    await expect(page.locator('.history-row')).toHaveCount(2);
    await release(page, search.id);
    await page.clock.runFor(1000);
    const resumed = await saveCurrentGame(page, 'resumed-reply');
    expect(resumed.livePath).toEqual([0, 0]);
    expect(resumed.clockSnapshot.black.remainingMs).toBe(62000);
    expect(await playerSearchCount(page)).toBe(1);
  });
}
for (const releaseAt of ['branch', 'after-exit'] as const) {
  test(`JRN-RACE-02 releases pending work at ${releaseAt} without moving the explored board`, async ({ page }) => {
    await openRace(page);
    const search = await heldPlayer(page);
    await page.getByRole('button', { name: /^Analyse/ }).click();
    await playMove(page, 'e7', 'e5');
    await playMove(page, 'g1', 'f3');
    if (releaseAt === 'branch') await release(page, search.id);
    await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
    const explored = await saveCurrentGame(page, 'explored');
    expect(explored.livePath).toEqual(releaseAt === 'branch' ? [0, 1] : [0]);
    expect(explored.renderedPath).toHaveLength(3);
    expect(explored.clockSnapshot.black.remainingMs).toBe(releaseAt === 'branch' ? 62000 : 60000);
    await page.getByRole('button', { name: /^Exit analysis/ }).click();
    if (releaseAt === 'after-exit') await release(page, search.id);
    await expect(page.locator('.history-row')).toHaveCount(releaseAt === 'branch' ? 4 : 2);
    await release(page, search.id);
    const live = await saveCurrentGame(page, 'live');
    expect(live.livePath).toEqual(releaseAt === 'branch' ? [0, 1] : [0, 0]);
    expect(live.renderedPath).toEqual(live.livePath);
    expect(live.clockSnapshot.black.remainingMs).toBe(62000);
    expect(await playerSearchCount(page)).toBe(1);
  });
}
