import { test, expect } from './SaveTest';
import { invalidSaveNames } from '../../../journeys/definitions/saves/data/SaveName';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { readFile, readGame, managedFiles } from '../../support/SaveInspection';
import { expectCanonical, fileSnapshot, openLibraryGame, reloadSaved, setAutosaveInterval, snapshotRow } from './SaveAction';
test('JRN-SAVE-03 @smoke saves a new named snapshot then reloads and loads its canonical workspace', async ({ page }) => {
  await openLibraryGame(page);
  await playMove(page, 'f1', 'b5');
  const saved = await saveCurrentGame(page, 'New snapshot');
  expect(saved.renderedPath).toHaveLength(5);
  expect(saved.whitePlayer?.type).toBe('local');
  expect(saved.resultState).toBe('ongoing');
  await reloadSaved(page, 'saves/save-library/New snapshot.json');
  await expect(square(page, 'b5')).toHaveAttribute('aria-label', 'b5 white bishop');
  expectCanonical(await saveCurrentGame(page, 'After reload'), saved);
  await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
  await page.locator('.game-row').filter({ hasText: 'Library middlegame' }).click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  await snapshotRow(page, 'New snapshot').locator('.save-row__content').click();
  await page.getByRole('button', { name: 'Load selected', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
  expectCanonical(await saveCurrentGame(page, 'Loaded snapshot'), saved);
  expect((await managedFiles(page)).filter((path) => path === 'saves/save-library/New snapshot.json')).toHaveLength(1);
});
for (const confirm of [false, true]) {
  test(`JRN-SAVE-04 ${confirm ? 'confirms' : 'cancels'} replacement of only the chosen snapshot`, async ({ page }) => {
    await openLibraryGame(page);
    await setAutosaveInterval(page, 0);
    await playMove(page, 'f1', 'b5');
    const before = await fileSnapshot(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByLabel('Save name').fill('Opening');
    await page.getByRole('button', { name: 'Save game', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Replace this save?', exact: true });
    expect(await fileSnapshot(page)).toEqual(before);
    await dialog.getByRole('button', { name: confirm ? 'Replace save' : 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/saved-games\/save\/save-library$/);
    if (!confirm) {
      expect(await fileSnapshot(page)).toEqual(before);
      await expect(page.getByLabel('Save name')).toHaveValue('Opening');
      return;
    }
    await expect(page.getByLabel('Selected save details')).toContainText('5 plies');
    const after = await fileSnapshot(page);
    expect({ ...after, 'saves/save-library/Opening.json': before['saves/save-library/Opening.json'] }).toEqual(before);
    expect((await readGame(page, 'saves/save-library/Opening.json')).renderedPath).toHaveLength(5);
  });
}
for (const { label, value } of invalidSaveNames) {
  test(`JRN-SAVE-05 rejects ${label} before writing a managed snapshot`, async ({ page }) => {
    await openLibraryGame(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const before = await fileSnapshot(page);
    const input = page.getByLabel('Save name');
    await input.fill(value);
    await expect(page.getByRole('button', { name: 'Save game', exact: true })).toBeDisabled();
    await input.press('Enter');
    await expect(input).toBeFocused();
    await expect(page.locator('.field-error')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await fileSnapshot(page)).toEqual(before);
    await input.fill('Recovered');
    await expect(page.getByRole('button', { name: 'Save game', exact: true })).toBeEnabled();
    expect(await readFile(page, 'saves/save-library/auto.json')).toBe(before['saves/save-library/auto.json']);
  });
}
