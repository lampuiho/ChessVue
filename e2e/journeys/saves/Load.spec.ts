import { test, expect } from './SaveTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { square } from '../../support/BoardInteraction';
import { readGame, readSession } from '../../support/SaveInspection';
import { saveCurrentGame } from '../../support/GameSave';
import { expectCanonical, snapshotRow } from './SaveAction';
test('JRN-SAVE-01 selects groups and snapshots without loading and shows autosave before named saves', async ({ page }) => {
  await openJourney(page, 'saves');
  const before = await readSession(page);
  await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
  await page.locator('.game-row').filter({ hasText: 'Second saved game' }).click();
  await expect(page).toHaveURL(/\/saved-games\/load$/);
  expect((await readSession(page)).openGameIds).toEqual(before.openGameIds);
  await page.locator('.game-row').filter({ hasText: 'Library middlegame' }).click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  await expect(page.locator('.save-row').first()).toContainText('Automatic save');
  await expect(page.getByRole('separator')).toHaveText('Named saves');
  for (const [name, plies] of [['Opening', 2], ['Middlegame', 4]] as const) {
    await snapshotRow(page, name).locator('.save-row__content').click();
    await expect(page.getByLabel('Selected save details')).toContainText(`${plies} plies`);
    await expect(page.getByLabel('Selected save details')).toContainText(`Library ${name.toLowerCase()}`);
    await expect(snapshotRow(page, name).locator('.save-row__content')).toHaveAttribute('aria-pressed', 'true');
  }
  expect((await readSession(page)).openGameIds).toEqual(before.openGameIds);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/save-library$/);
});
for (const method of ['selected', 'latest']) {
  test(`JRN-SAVE-02 loads ${method === 'selected' ? 'Opening explicitly' : 'latest Middlegame by double click'}`, async ({ page }) => {
    await openJourney(page, 'saves');
    const expected = await readGame(page, `saves/save-library/${method === 'selected' ? 'Opening' : 'Middlegame'}.json`);
    if (method === 'selected') {
      await snapshotRow(page, 'Opening').locator('.save-row__content').click();
      await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    } else {
      await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
      await page.locator('.game-row').filter({ hasText: 'Library middlegame' }).dblclick();
    }
    await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
    await expect(page.locator('.history-row')).toHaveCount(expected.renderedPath.length);
    await expect(square(page, method === 'selected' ? 'g1' : 'f3')).toHaveAttribute('aria-label', `${method === 'selected' ? 'g1' : 'f3'} white knight`);
    expectCanonical(await saveCurrentGame(page, 'Loaded'), expected);
  });
}
