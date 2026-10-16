import { test, expect } from '../../support/TestEvidence';
import { openJourney } from '../../support/JourneyBootstrap';
import { openCustomGame, setCustomClock } from '../../support/GameCreation';
import { managedFiles, readSession } from '../../support/SaveInspection';

for (const dismissal of ['Cancel', 'Close dialog', 'Escape', 'backdrop']) {
  test(`JRN-FRESH-03 dismisses custom creation using ${dismissal}`, async ({ page }) => {
    await openJourney(page, 'fresh');
    const before = await managedFiles(page);
    const dialog = await openCustomGame(page);
    await dialog.getByLabel('Name', { exact: false }).fill('Cancelled game');
    await setCustomClock(dialog);
    if (dismissal === 'Escape') await dialog.getByLabel('Minutes', { exact: true }).press('Escape');
    else if (dismissal === 'backdrop') await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
    else await dialog.getByRole('button', { name: dismissal, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/home$/);
    expect((await readSession(page)).openGameIds).toEqual([]);
    expect(await managedFiles(page)).toEqual(before);
    await openCustomGame(page);
    await expect(page.getByLabel('Name', { exact: false })).toHaveValue('New Game');
  });
}
