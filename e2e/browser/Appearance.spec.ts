import { expectTheme } from '../support/Appearance';
import { test, expect } from './BrowserTest';
import { browserDocument, browserFiles, browserStorageSnapshot } from './BrowserStorage';
import { createGame, playOpening } from './BrowserAction';
import { browserThemeModes } from '../../journeys/definitions/browser/data/BrowserScenario';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.matchMedia = () => { throw new Error('App appearance must use CSS system-theme selection.'); };
  });
});
for (const mode of browserThemeModes) {
  test(`JRN-BROWSER-07 follows system theme policy in ${mode} mode and restores the accepted preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.getByRole('button', { name: /Settings/ }).click();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('radio', { name: mode, exact: true }).check();
    if (mode !== 'system') await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
    const before = await browserDocument(page, 'settings.json');
    for (const colour of ['dark', 'light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: colour });
      await expect(page.locator('html')).toHaveAttribute('data-theme-mode', mode);
      await expectTheme(page, mode === 'system' ? colour : mode);
      expect(await browserDocument(page, 'settings.json')).toEqual(before);
    }
    await page.reload();
    await expectTheme(page, mode === 'system' ? 'dark' : mode);
    await expect(page.getByRole('radio', { name: mode, exact: true })).toBeChecked();
    expect(await browserDocument(page, 'settings.json')).toEqual(before);
  });
}
test('JRN-BROWSER-07 keeps a rejected storage write non-durable through reload then persists an explicit retry', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await createGame(page);
  await playOpening(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const before = await browserFiles(page);
  const storageBefore = await browserStorageSnapshot(page);
  await page.getByRole('radio', { name: 'dark', exact: true }).check();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage && key === 'chessvue:files:v1' && JSON.parse(value).files['settings.json']?.raw !== JSON.parse(localStorage.getItem(key)!).files['settings.json']?.raw) {
        Storage.prototype.setItem = original;
        throw new DOMException('Controlled browser quota rejection', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('.settings-feedback--error')).toContainText('Browser storage could not be written');
  await expectTheme(page, 'light');
  await expect(page.getByRole('radio', { name: 'dark', exact: true })).toBeChecked();
  expect(await browserFiles(page)).toEqual(before);
  expect(await browserStorageSnapshot(page)).toBe(storageBefore);
  await page.reload();
  await expectTheme(page, 'light');
  await expect(page.getByRole('radio', { name: 'system', exact: true })).toBeChecked();
  expect(await browserDocument(page, 'settings.json')).toEqual(before['settings.json'] ? JSON.parse(before['settings.json']) : undefined);
  await page.getByRole('radio', { name: 'dark', exact: true }).check();
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('.settings-feedback')).toHaveText('Settings applied.');
  await expectTheme(page, 'dark');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  await page.reload();
  await expectTheme(page, 'dark');
  await expect(page.locator('.history-row')).toHaveCount(1);
});
