import { test, expect } from './SettingsTest';
import type { Locator, Page } from '@playwright/test';
import { openJourney } from '../../support/JourneyBootstrap';
import { square, playMove } from '../../support/BoardInteraction';
import { openCustomGame } from '../../support/GameCreation';
import { applySettings, returnToGame } from './SettingsAction';
async function expectReachable(page: Page, control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  expect(box.width).toBeGreaterThan(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}
for (const scale of [75, 150]) {
  test(`JRN-SETTINGS-03 keeps board dialogs and library reachable at ${scale}%`, async ({ page }) => {
    await openJourney(page, 'settings');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    const slider = page.getByRole('slider');
    await expect(slider).toHaveAttribute(scale === 75 ? 'min' : 'max', String(scale));
    await slider.fill(String(scale));
    await applySettings(page);
    await expect(page.locator('html')).toHaveCSS('font-size', `${16 * scale / 100}px`);
    await expectReachable(page, page.getByRole('button', { name: 'Back to game', exact: true }));
    await returnToGame(page);
    await expectReachable(page, square(page, 'h1'));
    await expectReachable(page, square(page, 'a8'));
    await playMove(page, 'g1', 'f3');
    await expect(page.locator('.history-row')).toHaveCount(3);
    const dialog = await openCustomGame(page);
    await expectReachable(page, dialog.getByLabel('Name', { exact: false }));
    await expectReachable(page, dialog.getByRole('button', { name: 'Create workspace', exact: true }));
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expectReachable(page, page.getByRole('button', { name: 'Close', exact: true }));
    await expect(page.getByText('Return from settings', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(square(page, 'f3').locator('.chess-piece')).toHaveCount(1);
  });
}
