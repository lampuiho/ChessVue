import { expect, type Page } from '@playwright/test';

export async function openJourney(page: Page, name: string) {
  await page.goto('/?journey=' + encodeURIComponent(name) + '&reset=1');
  await waitForJourney(page);
}
export async function waitForJourney(page: Page) {
  await page.waitForFunction(() => window.chessVueJourney?.ready);
  await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'false');
  await expect(page.locator('.app-loading')).toHaveCount(0);
}
