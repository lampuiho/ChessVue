import { test, expect } from './StorageTest';
import { playMove } from '../../support/BoardInteraction';
import { readGame } from '../../support/SaveInspection';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { expectOperation, failNext, gamePath, managedSnapshot, openStorageGame } from './StorageAction';
for (const name of ['New snapshot', 'Opening']) {
  test(`JRN-IO-01 preserves prior files after failed ${name === 'Opening' ? 'overwrite' : 'named save'} and retries the intended snapshot`, async ({ page }) => {
    await openStorageGame(page);
    await playMove(page, 'f1', 'b5');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const before = await managedSnapshot(page);
    const path = gamePath + name + '.json';
    await failNext(page, 'writeTextFile', path);
    await page.getByLabel('Save name').fill(name);
    await page.getByRole('button', { name: 'Save game', exact: true }).click();
    const replace = page.getByRole('dialog', { name: 'Replace this save?', exact: true });
    if (name === 'Opening') await replace.getByRole('button', { name: 'Replace save', exact: true }).click();
    await expectOperation(page, 'writeTextFile', path, 'failed');
    await expect(page.locator('.library-actions .library-feedback--error')).toContainText('Try again');
    if (name === 'Opening') await expect(replace.getByRole('alert')).toContainText('Try again');
    await expect(page.locator('.library-actions')).not.toContainText('Saved “');
    expect(await managedSnapshot(page)).toEqual(before);
    expect((await readGame(page, gamePath + 'Opening.json')).renderedPath).toHaveLength(2);
    await page.getByRole('button', { name: name === 'Opening' ? 'Replace save' : 'Save game', exact: true }).click();
    await expect(page.locator('.library-actions')).toContainText(`Saved “${name}”`);
    await expect(page.getByLabel('Selected save details')).toContainText('5 plies');
    const after = await managedSnapshot(page);
    delete after[path];
    const unchanged = { ...before };
    delete unchanged[path];
    expect(after).toEqual(unchanged);
    expect((await readGame(page, path)).renderedPath).toHaveLength(5);
    await page.reload();
    await waitForJourney(page);
    expect((await readGame(page, path)).renderedPath).toHaveLength(5);
  });
}
