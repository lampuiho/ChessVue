import { test, expect } from './SaveTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { readSession } from '../../support/SaveInspection';
import { fileSnapshot } from './SaveAction';
for (const fixture of ['corrupt', 'unsupported-version', 'incomplete']) {
  test(`JRN-SAVE-09 rejects ${fixture} import without partial insertion and then imports valid data`, async ({ page }) => {
    await openJourney(page, 'saves');
    const before = await fileSnapshot(page);
    const session = await readSession(page);
    await page.evaluate((path) => window.chessVueJourney.chooseImport(path), `imports/${fixture}.json`);
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Could not import game', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(fixture === 'corrupt' ? 'Invalid JSON' : fixture === 'incomplete' ? 'payload is invalid' : 'schema version is unsupported');
    expect(await fileSnapshot(page)).toEqual(before);
    expect(await readSession(page)).toEqual(session);
    await expect(page).toHaveURL(/\/saved-games\/load\/save-library$/);
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.evaluate(() => window.chessVueJourney.chooseImport('imports/valid.json'));
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!save-library$|import-external$).+/);
    await expect(page.getByRole('heading', { name: 'External imported game', exact: true })).toBeVisible();
    expect((await readSession(page)).openGameIds).toHaveLength(session.openGameIds.length + 1);
  });
}
for (const action of ['import', 'export']) {
  test(`JRN-SAVE-10 cancels ${action} without a write or success message and allows retry`, async ({ page }) => {
    await openJourney(page, 'saves');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const before = await fileSnapshot(page);
    const session = await readSession(page);
    await page.evaluate((kind) => {
      if (kind === 'import') window.chessVueJourney.chooseImport(null);
      else window.chessVueJourney.chooseExport(null);
    }, action);
    await page.getByRole('button', { name: action === 'import' ? 'Import file' : 'Export', exact: true }).click();
    await expect(page).toHaveURL(/\/saved-games\/save\/save-library$/);
    await expect(page.locator('.library-feedback')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await fileSnapshot(page)).toEqual(before);
    expect(await readSession(page)).toEqual(session);
    await page.evaluate((kind) => {
      if (kind === 'import') window.chessVueJourney.chooseImport('imports/valid.json');
      else window.chessVueJourney.chooseExport('exports/retry.json');
    }, action);
    await page.getByRole('button', { name: action === 'import' ? 'Import file' : 'Export', exact: true }).click();
    if (action === 'import') await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
    else await expect.poll(() => page.evaluate(() => window.chessVueJourney.readFile('exports/retry.json'))).toBeTruthy();
  });
}
