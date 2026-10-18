import { test, expect } from './RecoveryTest';
import { playMove } from '../../support/BoardInteraction';
import { expectSession, openRecovery, sourceFiles } from './RecoveryAction';
for (const action of ['Dismiss', 'Saved games', 'Settings']) {
  test(`JRN-RECOVERY-06 follows the recovery notice ${action} action and continues normal play`, async ({ page }) => {
    await openRecovery(page);
    const before = await sourceFiles(page);
    const notice = page.locator('.recovery-notice');
    await notice.getByRole('button', { name: action, exact: true }).click();
    if (action === 'Dismiss') await expect(notice).toHaveCount(0);
    else {
      await expect(page).toHaveURL(action === 'Settings' ? /\/settings\/session$/ : /\/saved-games\/load$/);
      if (action === 'Settings') await expect(page.getByLabel('Autosave interval')).toBeEnabled();
      else await expect(page.locator('.game-row').filter({ hasText: 'Recoverable valid game' })).toBeVisible();
      await notice.getByRole('button', { name: 'Dismiss', exact: true }).click();
      await page.getByRole('button', { name: action === 'Settings' ? 'Back to game' : 'Cancel', exact: true }).click();
    }
    await expectSession(page, ['recovery-valid'], '/game/recovery-valid', 'recovery-valid');
    expect(await sourceFiles(page)).toEqual(before);
    await playMove(page, 'e7', 'e5');
    await expect(page.locator('.history-row')).toHaveCount(2);
    await expect(page.locator('.result-badge')).toHaveText('white to move');
  });
}
