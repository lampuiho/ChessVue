import { test, expect, raceTime } from './RaceTest';
import { openRace, heldPlayer, release, emit, latestSearch } from './RaceAction';
import { playMove } from '../../support/BoardInteraction';
import { choosePlayer } from '../play/PlaySetup';
import { saveCurrentGame } from '../../support/GameSave';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { readFile } from '../../support/SaveInspection';
for (const replacement of ['Local player', 'Journey B', 'Unassigned']) {
  test(`JRN-RACE-03 cancels the old reply when assigning ${replacement}`, async ({ page }) => {
    await openRace(page);
    const other = await readFile(page, 'saves/race-independent/auto.json');
    const search = await heldPlayer(page);
    await choosePlayer(page, 'Black', replacement);
    await emit(page, search.id, 'bestmove a7a6');
    await expect(page.locator('.history-row')).toHaveCount(1);
    if (replacement === 'Journey B') await release(page, (await latestSearch(page, 'player', 'journey://b')).id);
    else await playMove(page, 'e7', 'e5');
    await expect(page.locator('.history-row')).toHaveCount(2);
    const saved = await saveCurrentGame(page, 'replacement');
    expect(saved.livePath).toEqual(replacement === 'Unassigned' ? undefined : [0, 0]);
    expect(saved.blackPlayer?.displayName).toBe(replacement === 'Journey B' ? 'Journey B' : replacement === 'Unassigned' ? undefined : 'Black');
    expect(await readFile(page, 'saves/race-independent/auto.json')).toBe(other);
    await expect.poll(() => page.evaluate((id) => window.chessVueJourney.engines.processes().find((p) => p.id === id)?.listeners, search.processId)).toBe(0);
  });
}
for (const ending of ['timeout', 'resignation', 'draw'] as const) {
  test(`JRN-RACE-04 ignores a held reply after ${ending}`, async ({ page }) => {
    if (ending === 'draw') {
      await page.goto('/?journey=engine-races&variant=incoming-draw&reset=1');
      await waitForJourney(page);
      await page.evaluate(() => window.chessVueJourney.engines.hold('player'));
    } else await openRace(page);
    const search = await heldPlayer(page);
    if (ending === 'timeout') {
      await page.clock.setFixedTime(new Date(raceTime.getTime() + 61000));
      await page.clock.runFor(250);
      await page.getByRole('dialog', { name: 'Time has expired', exact: true }).getByRole('button', { name: 'Review game', exact: true }).click();
    } else if (ending === 'resignation') {
      await page.getByRole('button', { name: 'Resign', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Resign', exact: true }).click();
    } else await page.getByRole('button', { name: 'Resolve draw', exact: true }).click();
    const before = await saveCurrentGame(page, 'ended-before');
    await release(page, search.id);
    await page.clock.runFor(1000);
    const after = await saveCurrentGame(page, 'ended-after');
    expect(after.resultReason).toBe(ending === 'draw' ? 'drawAgreement' : ending);
    expect(after.resultState).toBe(ending === 'draw' ? 'drawn' : 'whiteWon');
    expect(after.livePath).toEqual([0]);
    expect(after.moveTree).toEqual(before.moveTree);
    expect(after.clockSnapshot).toEqual(before.clockSnapshot);
    await expect(page.locator('.history-row')).toHaveCount(1);
  });
}
