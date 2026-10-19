import { test, expect } from './StorageTest';
import { snapshotRow } from '../../support/SnapshotBrowser';
import { failNext, gamePath, managedSnapshot, openSnapshots, openStorageGame } from './StorageAction';
for (const failure of ['denied', 'removed']) {
  test(`JRN-IO-05 refreshes selection after ${failure} deletion and preserves neighbouring files`, async ({ page }) => {
    await openStorageGame(page);
    await openSnapshots(page);
    await snapshotRow(page, 'Opening').locator('.save-row__content').click();
    await expect(page.getByLabel('Selected save details')).toContainText('2 plies');
    const before = await managedSnapshot(page);
    const path = gamePath + 'Opening.json';
    await snapshotRow(page, 'Opening').getByRole('button', { name: 'Delete save', exact: true }).click();
    if (failure === 'denied') await failNext(page, 'deleteFile', path);
    else await page.evaluate((path) => window.chessVueJourney.changeFile(path, null), path);
    await page.getByRole('dialog', { name: 'Delete this save?', exact: true }).getByRole('button', { name: 'Delete save', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.library-actions .library-feedback--error')).toBeVisible();
    await expect(page).toHaveURL(/\/saved-games\/load\/io-game$/);
    if (failure === 'denied') {
      expect(await managedSnapshot(page)).toEqual(before);
      await snapshotRow(page, 'Opening').getByRole('button', { name: 'Delete save', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete save', exact: true }).click();
    }
    await expect(snapshotRow(page, 'Opening')).toHaveCount(0);
    await expect(page.getByLabel('Selected save details')).toContainText('4 plies');
    const expected = { ...before };
    delete expected[path];
    expect(await managedSnapshot(page)).toEqual(expected);
    await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(4);
  });
}
test('JRN-IO-05 returns to the grouped library when the final targets disappear before deletion', async ({ page }) => {
  await openStorageGame(page);
  await openSnapshots(page);
  const before = await managedSnapshot(page);
  await snapshotRow(page, 'Opening').getByRole('button', { name: 'Delete save', exact: true }).click();
  await page.evaluate(() => {
    for (const path of window.chessVueJourney.listFiles().filter((path) => path.startsWith('saves/io-game/'))) window.chessVueJourney.changeFile(path, null);
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Delete save', exact: true }).click();
  await expect(page).toHaveURL(/\/saved-games\/load$/);
  await expect(page.locator('.library-feedback--error')).toBeVisible();
  await expect(page.locator('.game-row')).toHaveCount(1);
  expect(await managedSnapshot(page)).toEqual(Object.fromEntries(Object.entries(before).filter(([path]) => path.startsWith('saves/io-other/'))));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(4);
});
