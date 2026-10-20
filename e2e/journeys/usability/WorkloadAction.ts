import { expect, type Page } from '@playwright/test';
import { usabilityWorkload } from '../../../journeys/definitions/usability/data/UsabilityScenario';
export async function exerciseHistory(page: Page) {
  await expect(page.locator('.history-row')).toHaveCount(usabilityWorkload.plies + 8);
  await page.locator('.history-row').first().click();
  await expect(page.locator('.history-row').first()).toHaveClass(/history-row--selected/);
  await page.getByRole('button', { name: 'Live position', exact: true }).click();
  await expect(page.locator('.history-row--selected .history-row__number')).toContainText('80');
}
export async function exerciseRoutes(page: Page, cycle: number) {
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  const snapshots = page.locator('.save-row__content');
  await expect(snapshots).toHaveCount(usabilityWorkload.snapshots + 1);
  await snapshots.nth(cycle % usabilityWorkload.snapshots + 1).click();
  await expect(page.getByLabel('Selected save details')).toContainText(`${(usabilityWorkload.snapshots - cycle % usabilityWorkload.snapshots) * usabilityWorkload.snapshotStepPlies} plies`);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Back to game', exact: true }).click();
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function exerciseEngine(page: Page) {
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await dialog.getByRole('radio', { name: /Journey A/ }).check();
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const engine = page.locator('.engine-section');
  await expect(engine.locator('.engine-section__score')).toHaveText('+0.24');
  await expect(engine).toContainText('Depth 12');
  await engine.getByRole('button', { name: 'Stop engine', exact: true }).click();
  await expect(engine.locator('.engine-section__status--ready')).toBeVisible();
  await engine.getByRole('button', { name: 'Remove engine', exact: true }).click();
  await expect(engine).toHaveCount(0);
}
