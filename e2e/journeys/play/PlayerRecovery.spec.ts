import { test, expect } from './PlayTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { choosePlayer, createTimedPlay } from './PlaySetup';

for (const action of ['Cancel', 'Keep']) {
  test(`JRN-PLAY-12 preserves the existing engine using ${action}`, async ({ page }) => {
    await openJourney(page, 'play');
    await createTimedPlay(page);
    await choosePlayer(page, 'Black', 'Journey A');
    const before = await saveCurrentGame(page, 'seat-before');
    await page.getByRole('button', { name: 'Journey A', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose a player', exact: true });
    await expect(dialog.getByRole('radio', { name: /Keep Journey A/ })).toBeChecked();
    if (action === 'Cancel') {
      await dialog.getByRole('radio', { name: /Journey B/ }).check();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    } else await dialog.getByRole('button', { name: 'Assign player', exact: true }).click();
    const after = await saveCurrentGame(page, 'seat-after');
    expect(after.blackPlayer).toEqual(before.blackPlayer);
    expect(after.livePath).toEqual(before.livePath);
    expect(after.moveTree).toEqual(before.moveTree);
    await playMove(page, 'e2', 'e4');
    await expect(page.locator('.history-row')).toHaveCount(2);
    await expect(page.locator('.player-name').first()).toHaveText('Journey A');
  });
}
test('JRN-PLAY-12 reports an unavailable due engine and recovers by reassignment', async ({ page }) => {
  await openJourney(page, 'play');
  await createTimedPlay(page);
  await playMove(page, 'e2', 'e4');
  const before = await saveCurrentGame(page, 'before-failure');
  await choosePlayer(page, 'Black', 'Journey unavailable');
  await expect(page.locator('.player-panel').first().getByRole('alert')).toContainText(/unavailable/i);
  await expect(page.locator('.history-row')).toHaveCount(1);
  const failed = await saveCurrentGame(page, 'failed-seat');
  expect(failed.blackPlayer?.displayName).toBe('Journey unavailable');
  expect(failed.moveTree).toEqual(before.moveTree);
  expect(failed.livePath).toEqual(before.livePath);
  expect(failed.resultState).toBe('ongoing');
  await choosePlayer(page, 'Black', 'Local player');
  await page.clock.runFor(1000);
  await playMove(page, 'e7', 'e5');
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(page.locator('.result-badge')).toHaveText('white to move');
  await expect(page.locator('.engine-state')).toHaveCount(0);
});
