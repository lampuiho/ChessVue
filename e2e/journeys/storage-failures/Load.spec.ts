import { test, expect } from './StorageTest';
import { playMove, square } from '../../support/BoardInteraction';
import { snapshotRow } from '../../support/SnapshotBrowser';
import { readFile, readSession } from '../../support/SaveInspection';
import { expectOperation, failNext, gamePath, managedSnapshot, openSnapshots, openStorageGame } from './StorageAction';
for (const path of ['saves', 'saves/io-game']) {
  test(`JRN-IO-04 recovers from listing failure at ${path} without loading a partial workspace`, async ({ page }) => {
    await openStorageGame(page);
    const before = await managedSnapshot(page);
    await failNext(page, 'listDirectory', path);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expectOperation(page, 'listDirectory', path, 'failed');
    await expect(page.locator('.library-feedback--error')).toContainText('Try again');
    await expect(page.getByText('Opening your library')).toHaveCount(0);
    expect((await readSession(page)).openGameIds).toEqual(['io-game', 'io-other']);
    expect(await managedSnapshot(page)).toEqual(before);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await playMove(page, 'f1', 'b5');
    await openSnapshots(page);
    await snapshotRow(page, 'Opening').locator('.save-row__content').click();
    await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!io-game$).+/);
    await expect(page.locator('.history-row')).toHaveCount(2);
    expect(await managedSnapshot(page)).toEqual(before);
  });
}
for (const failure of ['read', 'removed']) {
  test(`JRN-IO-04 rejects ${failure} selected snapshot at Load and allows another valid load`, async ({ page }) => {
    await openStorageGame(page);
    await playMove(page, 'f1', 'b5');
    await openSnapshots(page);
    await snapshotRow(page, 'Opening').locator('.save-row__content').click();
    await expect(page.getByLabel('Selected save details')).toContainText('2 plies');
    const before = await managedSnapshot(page);
    const path = gamePath + 'Opening.json';
    if (failure === 'read') await failNext(page, 'readTextFile', path);
    else await page.evaluate((path) => window.chessVueJourney.changeFile(path, null), path);
    await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    await expect(page.locator('.library-actions .library-feedback--error')).toBeVisible();
    await expect(page).toHaveURL(/\/saved-games\/load\/io-game$/);
    expect((await readSession(page)).openGameIds).toEqual(['io-game', 'io-other']);
    const expected = { ...before };
    if (failure === 'removed') delete expected[path];
    expect(await managedSnapshot(page)).toEqual(expected);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(square(page, 'b5')).toHaveAttribute('aria-label', 'b5 white bishop');
    await expect(page.locator('.history-row')).toHaveCount(5);
    await openSnapshots(page);
    await snapshotRow(page, 'Current').locator('.save-row__content').click();
    await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!io-game$).+/);
    await expect(page.locator('.history-row')).toHaveCount(4);
    expect(await managedSnapshot(page)).toEqual(expected);
  });
}
test('JRN-IO-04 shows a details read failure then recovers by reselecting the snapshot', async ({ page }) => {
  await openStorageGame(page);
  await openSnapshots(page);
  const before = await readFile(page, gamePath + 'Opening.json');
  await failNext(page, 'readTextFile', gamePath + 'Opening.json');
  await snapshotRow(page, 'Opening').locator('.save-row__content').click();
  await expect(page.getByLabel('Selected save details')).toContainText('Try again');
  await snapshotRow(page, 'Current').locator('.save-row__content').click();
  await expect(page.getByLabel('Selected save details')).toContainText('4 plies');
  await snapshotRow(page, 'Opening').locator('.save-row__content').click();
  await expect(page.getByLabel('Selected save details')).toContainText('2 plies');
  expect(await readFile(page, gamePath + 'Opening.json')).toBe(before);
});
