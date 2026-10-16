import { test, expect } from '../../support/TestEvidence';
import { openJourney } from '../../support/JourneyBootstrap';
import { createWorkspace, openCustomGame, setCustomClock } from '../../support/GameCreation';
import { managedFiles, readSession } from '../../support/SaveInspection';
import { saveCurrentGame } from '../../support/GameSave';
import validation from '../../../journeys/definitions/fresh/data/Validation.json' with { type: 'json' };

const fieldLabels: Record<string, string> = { name: 'Name', minutes: 'Minutes', increment: 'Increment (seconds)' };
for (const variant of validation.invalid) {
  test(`JRN-FRESH-05 rejects ${variant.name}`, async ({ page }) => {
    await openJourney(page, 'fresh');
    const before = await managedFiles(page);
    const dialog = await openCustomGame(page);
    await setCustomClock(dialog);
    await dialog.getByLabel(fieldLabels[variant.field]!).fill(variant.value);
    await expect(dialog.getByRole('alert')).toHaveText(variant.message);
    await expect(dialog.getByRole('button', { name: 'Create workspace', exact: true })).toBeDisabled();
    await dialog.getByLabel('Name').press('Enter');
    await expect(dialog).toBeVisible();
    expect((await readSession(page)).openGameIds).toEqual([]);
    expect(await managedFiles(page)).toEqual(before);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await openCustomGame(page);
    await expect(page.getByRole('button', { name: 'Create workspace', exact: true })).toBeEnabled();
  });
}
for (const variant of validation.valid) {
  test(`JRN-FRESH-05 accepts ${variant.name}`, async ({ page }) => {
    await openJourney(page, 'fresh');
    const dialog = await openCustomGame(page);
    await dialog.getByLabel('Name').fill('  Boundary game  ');
    await setCustomClock(dialog, variant.minutes, variant.increment);
    const gameId = await createWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Boundary game', exact: true })).toBeVisible();
    const game = await saveCurrentGame(page, 'Boundary');
    expect(game.timeControl).toEqual({ initialMs: Number(variant.minutes) * 60000, incrementMs: Number(variant.increment) * 1000 });
    expect((await readSession(page)).openGameIds).toEqual([gameId]);
  });
}
