import { test, expect } from './StorageTest';
import { snapshotRow } from '../../support/SnapshotBrowser';
import { readGame } from '../../support/SaveInspection';
import { expectOperation, gamePath, holdRead, managedSnapshot, openSnapshots, openStorageGame, releaseRead } from './StorageAction';
for (const destination of ['selection', 'group route', 'save route', 'board']) {
  test(`JRN-IO-07 rejects held details after changing ${destination} and preserves the current save target`, async ({ page }) => {
    await openStorageGame(page);
    await openSnapshots(page);
    const before = await managedSnapshot(page);
    const id = await holdRead(page, gamePath + 'Opening.json');
    await snapshotRow(page, 'Opening').locator('.save-row__content').click();
    await expectOperation(page, 'readTextFile', gamePath + 'Opening.json', 'held');
    if (destination === 'selection') {
      await snapshotRow(page, 'Current').locator('.save-row__content').click();
    } else if (destination === 'group route') {
      await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
      await page.locator('.game-row').filter({ hasText: 'Other storage game' }).click();
      await page.getByRole('button', { name: 'Select game', exact: true }).click();
    } else if (destination === 'save route') {
      await page.locator('.app-header').getByRole('button', { name: 'Save', exact: true }).click();
      await snapshotRow(page, 'Current').locator('.save-row__content').click();
      await page.getByRole('button', { name: 'Save game', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Replace this save?', exact: true })).toContainText('“Current”');
    } else await page.getByRole('button', { name: 'Close', exact: true }).click();
    await releaseRead(page, id);
    if (destination === 'board') {
      await expect(page.locator('.history-row')).toHaveCount(4);
      await openSnapshots(page);
      await expect(page.getByLabel('Selected save details')).toContainText('4 plies');
    } else if (destination === 'group route') {
      await expect(page.getByLabel('Selected save details')).toContainText('Other storage game');
      await expect(page.getByLabel('Selected save details')).toContainText('2 plies');
      await expect(page.getByLabel('Selected save details')).not.toContainText('Storage game');
    } else await expect(page.getByLabel('Selected save details')).toContainText('4 plies');
    expect(await managedSnapshot(page)).toEqual(before);
    if (destination === 'save route') {
      await page.getByRole('button', { name: 'Replace save', exact: true }).click();
      await expect(page.locator('.library-actions')).toContainText('Saved “Current”');
      expect((await readGame(page, gamePath + 'Current.json')).renderedPath).toHaveLength(4);
      expect(await page.evaluate(() => window.chessVueJourney.readFile('saves/io-game/Opening.json'))).toBe(before[gamePath + 'Opening.json']);
    }
  });
}
