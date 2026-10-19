import { test, expect } from './BrowserTest';
import { createGame, downloadGame, expectCanonical, exportGame, openSave, playOpening, uploadGame } from './BrowserAction';
import { browserDocument, browserFiles, browserGame, browserStorageSnapshot, gameId } from './BrowserStorage';
import type { IGameSessionSnapshot } from '../../src/contracts';
import { browserInvalidImports } from '../../journeys/definitions/browser/data/BrowserScenario';

test('JRN-BROWSER-02 round-trips a real download through the file chooser with fresh import identity', async ({ page }) => {
  await createGame(page);
  await playOpening(page);
  const id = gameId(page);
  const original = (await browserGame(page, id))!;
  await openSave(page);
  const before = await browserFiles(page);
  const downloaded = await downloadGame(page);
  expectCanonical(downloaded.game, original);
  expect(downloaded.game.schemaVersion).toBe(1);
  expect(await browserFiles(page)).toEqual(before);
  await uploadGame(page, downloaded.path);
  await expect(page).toHaveURL(/\/game\/.+/);
  const importedId = gameId(page);
  expect(importedId).not.toBe(id);
  await expect(page.locator('.history-row')).toHaveCount(1);
  const imported = await exportGame(page);
  expect(imported.metadata.id).toBe(importedId);
  expectCanonical(imported, downloaded.game, true);
  expect(await browserDocument<IGameSessionSnapshot>(page, 'game-session.json')).toMatchObject({ openGameIds: [id, importedId] });
  expect((await browserFiles(page))[`saves/${id}/auto.json`]).toBe(before[`saves/${id}/auto.json`]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.locator('.history-row')).toHaveCount(1);
  expectCanonical(await exportGame(page), imported);
});
for (const invalid of browserInvalidImports) {
  test(`JRN-BROWSER-02 rejects ${invalid.name} without mutation and permits a valid chooser retry`, async ({ page }) => {
    await createGame(page);
    await playOpening(page);
    await openSave(page);
    const downloaded = await downloadGame(page);
    const url = page.url();
    const before = await browserStorageSnapshot(page);
    await uploadGame(page, { name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(invalid.bytes) });
    const dialog = page.getByRole('dialog', { name: 'Could not import game', exact: true });
    await expect(dialog).toContainText(invalid.error);
    await expect(page).toHaveURL(url);
    expect(await browserStorageSnapshot(page)).toBe(before);
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await uploadGame(page, downloaded.path);
    await expect(page).toHaveURL(/\/game\/.+/);
    await expect(page.locator('.history-row')).toHaveCount(1);
    expectCanonical(await exportGame(page), downloaded.game, true);
  });
}
