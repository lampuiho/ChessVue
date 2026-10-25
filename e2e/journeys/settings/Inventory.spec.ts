import { test, expect } from './SettingsTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { openCustomGame } from '../../support/GameCreation';
import { saveCurrentGame } from '../../support/GameSave';
import { acceptedSettings, applySettings, editProfile, profileRow, returnToGame, saveProfile } from './SettingsAction';
test('JRN-SETTINGS-07 stages a profile then applies it to all future assignment choices @smoke', async ({ page }) => {
  await openJourney(page, 'settings');
  const original = await acceptedSettings(page);
  await profileRow(page, 'Journey A').getByTitle('Copy', { exact: true }).click();
  const editor = page.locator('.engine-editor');
  await editor.getByLabel('Profile name', { exact: true }).fill('New analyst');
  await editor.getByPlaceholder('Value', { exact: true }).nth(1).fill('32');

  await saveProfile(editor);
  await expect(profileRow(page, 'New analyst')).toBeVisible();
  expect(await acceptedSettings(page)).toEqual(original);
  await expect(page.locator('.unsaved-badge')).toBeVisible();
  await applySettings(page);
  await page.reload();
  await waitForJourney(page);
  expect((await acceptedSettings(page)).analysis.engineInventory.find((engine) => engine.displayName === 'New analyst')?.options).toEqual({ MultiPV: 3, Hash: 32 });
  await returnToGame(page);
  const custom = await openCustomGame(page);
  await expect(custom.getByLabel('White', { exact: true }).getByRole('option', { name: 'New analyst', exact: true })).toHaveCount(1);
  await expect(custom.getByLabel('Black', { exact: true }).getByRole('option', { name: 'New analyst', exact: true })).toHaveCount(1);
  await custom.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.player-panel').filter({ has: page.locator('.player-avatar .piece-artwork--white') }).locator('.player-name').click();
  await expect(page.getByRole('radio', { name: /New analyst/ })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: /^Analyse Explore/ }).click();
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const assignment = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await assignment.getByRole('radio', { name: /New analyst/ }).check();
  await assignment.getByRole('button', { name: 'Add engine', exact: true }).click();
  const seat = page.locator('.engine-section').filter({ hasText: 'New analyst' });
  await expect(seat.locator('.engine-section__name')).toHaveAttribute('title', 'Evaluating position');
  await expect(seat.locator('.engine-section__score')).toHaveText('+0.24');
  const saved = await saveCurrentGame(page, 'New profile seat');
  expect(saved.analysis.seats[0]!.assignedEngine.options).toEqual({ MultiPV: 3, Hash: 32 });
  expect(saved.analysis.seats[0]!.lines).toHaveLength(3);
});
test('JRN-SETTINGS-08 rejects invalid names gives copies distinct identities and cancels edits', async ({ page }) => {
  await openJourney(page, 'settings');
  const original = await acceptedSettings(page);
  const editor = await editProfile(page);
  await editor.getByLabel('Profile name', { exact: true }).fill('   ');
  await editor.getByRole('button', { name: 'Add profile', exact: true }).click();
  await expect(editor.getByRole('alert')).toHaveText('Profile name is required.');
  await editor.getByLabel('Profile name', { exact: true }).fill('Journey A');
  await editor.getByRole('button', { name: 'Add profile', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('already exists');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const copy of ['Journey A copy', 'Journey A copy 2']) {
    await profileRow(page, 'Journey A').getByTitle('Copy', { exact: true }).click();
    const dialog = page.locator('.engine-editor');
    await expect(dialog.getByLabel('Profile name', { exact: true })).toHaveValue(copy);
    if (copy.endsWith('2')) {
      await dialog.getByLabel('Profile name', { exact: true }).fill('Journey A copy');
      await dialog.getByRole('button', { name: 'Add profile', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('already exists');
      await dialog.getByLabel('Profile name', { exact: true }).fill(copy);
    }
    await saveProfile(dialog);
  }
  const editing = await editProfile(page, 'Journey A');
  await editing.getByLabel('Profile name', { exact: true }).fill('Cancelled rename');
  await editing.getByPlaceholder('Value', { exact: true }).first().fill('99');
  await editing.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(profileRow(page, 'Journey A')).toBeVisible();
  expect(await acceptedSettings(page)).toEqual(original);
  await applySettings(page);
  const profiles = (await acceptedSettings(page)).analysis.engineInventory;
  expect(new Set(profiles.map((engine) => engine.id)).size).toBe(5);
  expect(new Set(profiles.map((engine) => engine.displayName)).size).toBe(5);
  expect(profiles[0]).toEqual(original.analysis.engineInventory[0]);
  expect(profiles.slice(3).map((engine) => engine.options)).toEqual([profiles[0]!.options, profiles[0]!.options]);
});
