import { test, expect } from './SaveTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { readFile, readGame, readSession } from '../../support/SaveInspection';
import { saveCurrentGame } from '../../support/GameSave';
import { expectCanonical } from './SaveAction';
import { createRecordedWorkspace, reviewRecordedMove } from './RecordedAction';

test('JRN-SAVE-07 round-trips actual-move records after continued play and exploratory pruning', async ({ page }) => {
  const original = await createRecordedWorkspace(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.evaluate(() => window.chessVueJourney.chooseExport('exports/round-trip.json'));
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.library-feedback')).toHaveText('Game exported.');
  const exported = await readGame(page, 'exports/round-trip.json');
  expect(exported).toEqual(original);
  expect(exported.schemaVersion).toBe(1);
  expect(await readFile(page, 'exports/round-trip.json')).not.toContain('"$"');
  await page.evaluate(() => window.chessVueJourney.chooseImport('exports/round-trip.json'));
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
  const imported = await saveCurrentGame(page, 'Round trip');
  expect(imported.metadata.id).not.toBe(original.metadata.id);
  expectCanonical(imported, original);
  await page.reload();
  await waitForJourney(page);
  expectCanonical(await saveCurrentGame(page, 'Restored transfer'), imported);
  await reviewRecordedMove(page);
});
for (const fixture of ['valid', 'duplicate-id']) {
  test(`JRN-SAVE-08 @smoke imports ${fixture} with a fresh identity`, async ({ page }) => {
    await openJourney(page, 'saves');
    const originalSession = await readSession(page);
    const originalFile = await readFile(page, 'saves/save-library/auto.json');
    const external = await readGame(page, `imports/${fixture}.json`);
    await page.evaluate((path) => window.chessVueJourney.chooseImport(path), `imports/${fixture}.json`);
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!save-library$|import-external$).+/);
    const imported = await saveCurrentGame(page, 'Imported');
    expect(imported.metadata.id).not.toBe(external.metadata.id);
    expect({ ...imported, metadata: { ...imported.metadata, id: external.metadata.id, updatedAt: external.metadata.updatedAt } }).toEqual(external);
    const session = await readSession(page);
    expect(session.openGameIds).toEqual([...originalSession.openGameIds, imported.metadata.id]);
    expect(await readFile(page, 'saves/save-library/auto.json')).toBe(originalFile);
    await page.reload();
    await waitForJourney(page);
    await expect(page.getByRole('heading', { name: external.metadata.name, exact: true })).toBeVisible();
  });
}
