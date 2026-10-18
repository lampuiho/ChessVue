import { test, expect } from './RecoveryTest';
import { fallbackScenarios } from '../../../journeys/definitions/recovery/data/RecoveryScenario';
import { readFile } from '../../support/SaveInspection';
import { expectSession, openRecovery, reloadRecovery, sourceFiles } from './RecoveryAction';
for (const { name, route, ids, warning } of fallbackScenarios) {
  test(`JRN-RECOVERY-05 repairs ${name} without phantom tabs or implicit games`, async ({ page }) => {
    await openRecovery(page, name);
    const activeId = route.startsWith('/game/') ? route.slice('/game/'.length) : undefined;
    await expectSession(page, ids, route, activeId);
    await expect(page.locator('.recovery-notice')).toHaveCount(warning ? 1 : 0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(JSON.parse((await readFile(page, 'layout-state.json'))!).historyCollapsed).toBe(true);
    const before = await sourceFiles(page);
    if (ids.length > 1) await expect(page.locator('.tab-button__label')).toHaveText(['Second recovery game', 'Recoverable valid game']);
    else await expect(page.locator('.tab-button')).toHaveCount(0);
    if (!ids.length) {
      await expect(page.locator('.board-square')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Quick game/ })).toBeEnabled();
    } else await expect(page.getByRole('button', { name: 'Expand history', exact: true })).toBeVisible();
    await reloadRecovery(page);
    await expectSession(page, ids, route, activeId);
    expect(await sourceFiles(page)).toEqual(before);
    await expect(page.locator('.recovery-notice')).toHaveCount(0);
  });
}
