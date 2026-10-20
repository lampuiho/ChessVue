import { expect, type Locator, type Page } from '@playwright/test';
export async function expectViewport(page: Page) {
  expect(await page.evaluate(() => ({
    width: document.documentElement.scrollWidth <= innerWidth + 1,
    height: document.documentElement.scrollHeight <= innerHeight + 1,
    x: scrollX, y: scrollY,
  })), 'The document fits the viewport without scrolling').toEqual({ width: true, height: true, x: 0, y: 0 });
}
export async function expectReachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const clipped = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const reasons: string[] = [];
    if (rect.width <= 0 || rect.height <= 0 || rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1) reasons.push('viewport');
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX) && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) reasons.push(`${parent.className}: horizontal`);
      if (/(hidden|clip|auto|scroll)/.test(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) reasons.push(`${parent.className}: vertical`);
    }
    return reasons;
  });
  expect(clipped, `Reachable control: ${await control.textContent()}`).toEqual([]);
  await expectViewport(page);
}
export async function applyAppearance(page: Page, scale: number, theme: string, orientation: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('radio', { name: theme, exact: true }).check();
  await page.getByLabel('Orientation', { exact: true }).selectOption(orientation);
  await page.getByRole('slider', { name: 'Interface scale', exact: true }).fill(String(scale));
  const apply = page.getByRole('button', { name: 'Apply changes', exact: true });
  if (await apply.isEnabled()) await apply.click();
  await expect(page.locator('html')).toHaveCSS('font-size', `${16 * scale / 100}px`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expectReachable(page, page.getByRole('button', { name: 'Back to game', exact: true }));
  await page.getByRole('button', { name: 'Back to game', exact: true }).click();
}
