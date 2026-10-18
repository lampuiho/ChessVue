import { test, expect } from './RecoveryTest';
import { restoredRoutes } from '../../../journeys/definitions/recovery/data/RecoveryScenario';
import { readFile, readSession } from '../../support/SaveInspection';
import { playMove } from '../../support/BoardInteraction';
import { setSettingToggle } from '../settings/SettingsAction';
import { expandHistory, expectSession, openRecovery, reloadRecovery, sourceFiles } from './RecoveryAction';
for (const { name, route } of restoredRoutes) for (const resume of [true, false]) {
  test(`JRN-RECOVERY-03 restores ordered tabs and ${name} route with analysis resume ${resume ? 'on' : 'off'}`, async ({ page }) => {
    await openRecovery(page, `restore-${name}-${resume ? 'on' : 'off'}`);
    await expectSession(page, ['recovery-second', 'recovery-valid'], route, 'recovery-valid');
    const before = await sourceFiles(page);
    await expect(page.locator('.recovery-notice')).toHaveCount(0);
    if (name === 'settings') await expect(page.getByLabel('Orientation', { exact: true })).toHaveValue('black');
    else if (name === 'library') await expect(page.locator('.game-row')).toHaveCount(3);
    else if (name === 'library-selection') await expect(page.getByLabel('Selected save details')).toContainText('Second recovery game');
    else if (name === 'save') await expect(page.getByLabel('Save name')).toBeVisible();
    if (name !== 'game') await page.getByRole('button', { name: name === 'settings' ? 'Back to game' : name === 'save' ? 'Close' : 'Cancel', exact: true }).click();
    await expectSession(page, ['recovery-second', 'recovery-valid'], '/game/recovery-valid', 'recovery-valid');
    await expect(page.locator('.tab-button__label')).toHaveText(['Second recovery game', 'Recoverable valid game']);
    await expect(page.locator('.tab-button--active')).toContainText('Recoverable valid game');
    await expect(page.locator('.engine-section')).toHaveCount(2);
    if (resume) {
      await expect(page.locator('.engine-section__status--running')).toHaveCount(2);
      await expect(page.locator('.engine-summary')).toContainText('Depth 12');
    } else {
      await page.clock.runFor(1000);
      await expect(page.locator('.engine-section__status--running')).toHaveCount(0);
      await expect(page.locator('.engine-summary')).toContainText('No principal variation yet');
    }
    await expect(page.getByRole('button', { name: 'Expand history', exact: true })).toBeVisible();
    expect(await sourceFiles(page)).toEqual(before);
    await expandHistory(page);
    await expect(page.locator('.history-row')).toHaveCount(1);
    await playMove(page, 'e7', 'e5');
    await expect(page.locator('.history-row')).toHaveCount(2);
    expect((await readSession(page)).openGameIds).toEqual(['recovery-second', 'recovery-valid']);
  });
}
test('JRN-RECOVERY-04 disables session restore through Settings and retains loadable saved games', async ({ page }) => {
  await openRecovery(page, 'restore-settings-off');
  const saved = await readFile(page, 'saves/recovery-valid/auto.json');
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await setSettingToggle(page, 'Previous session', false);
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toHaveText('Settings applied.');
  await reloadRecovery(page);
  await expectSession(page, [], '/home');
  await expect(page.locator('.board-square, .tab-button, .recovery-notice')).toHaveCount(0);
  expect(await readFile(page, 'saves/recovery-valid/auto.json')).toBe(saved);
  await page.getByRole('button', { name: /Load game/ }).click();
  await page.locator('.game-row').filter({ hasText: 'Recoverable valid game' }).dblclick();
  await expect(page).toHaveURL(/\/game\/recovery-valid$/);
  await expandHistory(page);
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.result-badge')).toHaveText('black to move');
});
