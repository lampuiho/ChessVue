import { expectTheme } from '../../support/Appearance';
import { test, expect } from './RecoveryTest';
import { faultVariants } from '../../../journeys/definitions/recovery/data/RecoveryScenario';
import { playMove, square } from '../../support/BoardInteraction';
import { readFile } from '../../support/SaveInspection';
import { expectLayout, expectOriginalFaults, expectSession, openRecovery } from './RecoveryAction';
test('JRN-RECOVERY-01 restores the valid game with defaults and a recoverable combined warning @smoke', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openRecovery(page);
  await expectSession(page, ['recovery-valid'], '/game/recovery-valid', 'recovery-valid');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system');
  await expectTheme(page, 'light');
  await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', /^a8 /);
  await expectLayout(page, false);
  await expect(page.locator('.recovery-notice p')).toContainText(['Settings could not be read', 'default layout', 'recovery-missing', 'recovery-broken']);
  await expectOriginalFaults(page);
  await playMove(page, 'e7', 'e5');
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(square(page, 'e5')).toHaveAttribute('aria-label', 'e5 black pawn');
  await expect(page.locator('.result-badge')).toHaveText('white to move');
});
for (const variant of faultVariants) {
  test(`JRN-RECOVERY-02 isolates the ${variant} fault and preserves valid preferences and saves`, async ({ page }) => {
    await openRecovery(page, variant);
    await expectSession(page, ['recovery-valid'], '/game/recovery-valid', 'recovery-valid');
    await expect(page.locator('.recovery-notice p')).toHaveCount(1);
    const message = variant === 'settings' ? 'Settings could not be read' : variant === 'layout' ? 'default layout' : variant === 'missing-game' ? 'recovery-missing' : 'recovery-broken';
    await expect(page.locator('.recovery-notice')).toContainText(message);
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', variant === 'settings' ? 'system' : 'dark');
    await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', variant === 'settings' ? /^a8 / : /^h1 /);
    await expectLayout(page, variant !== 'layout');
    expect(JSON.parse((await readFile(page, 'saves/recovery-valid/auto.json'))!).livePath).toEqual([0]);
    if (variant !== 'settings') expect(JSON.parse((await readFile(page, 'settings.json'))!).gameSession.autosaveAfterMoveCount).toBe(3);
    if (variant === 'unsupported-game') expect(await readFile(page, 'saves/recovery-broken/auto.json')).toBe('{"schemaVersion":99}');
    await page.locator('.recovery-notice').getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.locator('.app-header').getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Autosave interval')).toHaveValue(variant === 'settings' ? '1' : '3');
  });
}
