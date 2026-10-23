import { test, expect } from './SettingsTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { openCustomGame } from '../../support/GameCreation';
import { applySettings, editProfile, openSettings, profileRow, returnToGame, saveProfile } from './SettingsAction';
for (const change of ['rename', 'remove']) {
  test(`JRN-SETTINGS-09 preserves a copied assignment and Keep existing after profile ${change}`, async ({ page }) => {
    await openJourney(page, 'settings');
    await returnToGame(page);
    await page.locator('.player-panel').filter({ has: page.getByText('Black', { exact: true }) }).locator('.player-name').click();
    await page.getByRole('radio', { name: /Journey A Configured UCI engine/ }).check();
    await page.getByRole('button', { name: 'Assign player', exact: true }).click();
    const original = await saveCurrentGame(page, 'Original assignment');
    await openSettings(page);
    if (change === 'rename') {
      const dialog = await editProfile(page, 'Journey A');
      await dialog.getByLabel('Display name', { exact: true }).fill('Changed profile');
      await dialog.getByLabel('Engine location').fill('journey://b');
      await dialog.getByPlaceholder('Value', { exact: true }).nth(1).fill('64');
      await saveProfile(dialog);
    } else await profileRow(page, 'Journey A').getByTitle('Delete', { exact: true }).click();
    await applySettings(page);
    await returnToGame(page);
    await page.locator('.player-panel').filter({ has: page.getByText('Black', { exact: true }) }).locator('.player-name').click();
    await expect(page.getByRole('radio', { name: /Keep Journey A/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Journey A Configured UCI engine/ })).toHaveCount(0);
    if (change === 'rename') await expect(page.getByRole('radio', { name: /Changed profile Configured UCI engine/ })).toBeVisible();
    await page.getByRole('button', { name: 'Assign player', exact: true }).click();
    expect((await saveCurrentGame(page, 'Kept assignment')).blackPlayer).toEqual(original.blackPlayer);
    const custom = await openCustomGame(page);
    await expect(custom.getByLabel('Black', { exact: true }).getByRole('option', { name: 'Journey A', exact: true })).toHaveCount(0);
    if (change === 'rename') await expect(custom.getByLabel('Black', { exact: true }).getByRole('option', { name: 'Changed profile', exact: true })).toHaveCount(1);
    await custom.getByRole('button', { name: 'Cancel', exact: true }).click();
    await playMove(page, 'g1', 'f3');
    await expect(page.locator('.history-row')).toHaveCount(4);
    expect((await saveCurrentGame(page, 'Continued assignment')).blackPlayer).toEqual(original.blackPlayer);
    await page.reload();
    await waitForJourney(page);
    await page.locator('.player-panel').filter({ has: page.getByText('Black', { exact: true }) }).locator('.player-name').click();
    await expect(page.getByRole('radio', { name: /Keep Journey A/ })).toBeChecked();
  });
}
