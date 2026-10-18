import { test, expect } from './RecoveryTest';
import { expectOriginalFaults, expectSession, openRecovery, reloadRecovery, sourceFiles } from './RecoveryAction';
test('JRN-RECOVERY-07 reloads the repaired session without requesting removed IDs or erasing corrupt sources', async ({ page }) => {
  await openRecovery(page);
  await expectSession(page, ['recovery-valid'], '/game/recovery-valid', 'recovery-valid');
  const before = await sourceFiles(page);
  for (let reload = 0; reload < 2; reload++) {
    await reloadRecovery(page);
    await expectSession(page, ['recovery-valid'], '/game/recovery-valid', 'recovery-valid');
    await expect(page.locator('.recovery-notice p')).toHaveCount(2);
    await expect(page.locator('.recovery-notice')).not.toContainText('recovery-missing');
    await expect(page.locator('.recovery-notice')).not.toContainText('recovery-broken');
    await expect(page.locator('.tab-button')).toHaveCount(0);
    await expect(page.locator('.history-row')).toHaveCount(1);
    await expectOriginalFaults(page);
    expect(await sourceFiles(page)).toEqual(before);
  }
});
