import { test, expect } from '@playwright/test';
import { playMove } from '../support/BoardInteraction';
test('JRN-IO-03 rejects a real browser storage write without accepting preferences and persists the retry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: /Quick game/ }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  await playMove(page, 'e2', 'e4');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('chessvue:files:v1'));
  await page.getByRole('radio', { name: 'dark', exact: true }).check();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage && key === 'chessvue:files:v1' && JSON.parse(value).files['settings.json']) {
        Storage.prototype.setItem = original;
        throw new DOMException('Controlled browser quota rejection', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('.settings-feedback--error')).toContainText('Browser storage could not be written');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('radio', { name: 'dark', exact: true })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('chessvue:files:v1'))).toBe(before);
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.history-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});
