import { expect, test, type Page } from '@playwright/test';

async function createGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Quick game/ }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
}
async function playOpening(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^e2 / }).click();
  await page.getByRole('button', { name: 'e4', exact: true }).click();
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
}
test('plays, saves and restores a browser game after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createGame(page);
  await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'false');
  await playOpening(page);
  const gameUrl = page.url();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Save name').fill('Browser opening');
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.locator('.save-row__content')).toContainText(['Browser opening']);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page).toHaveURL(gameUrl);
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
  await expect(page.locator('.history-list')).toContainText('e4');
  expect(errors).toEqual([]);
});
test('exports a download and imports it through the browser file picker', async ({ page }) => {
  await createGame(page);
  await playOpening(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const downloadPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPending;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const file = await download.path();
  expect(file).toBeTruthy();
  const pickerPending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await (await pickerPending).setFiles(file!);
  await expect(page).toHaveURL(/\/game\/.+/);
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
});
test('persists appearance settings in browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('radio', { name: 'dark', exact: true }).check();
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'dark', exact: true })).toBeChecked();
});

async function configureStockfish(page: Page, engineCount = 1): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Engines', exact: true }).click();
  for (let index = 0; index < engineCount; index++) {
    await page.getByRole('button', { name: 'Add engine', exact: true }).click();
    await page.getByLabel('Display name').fill(index === 0 ? 'Browser Stockfish' : `Browser Stockfish ${index + 1}`);
    await page.locator('#engine-path').fill('stockfish.js');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Custom game/ }).click();
}
test('runs concurrent Stockfish UCI workers and restores their analysis', async ({ page }) => {
  await configureStockfish(page, 2);
  await page.getByRole('button', { name: 'Free analysis', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Browser Stockfish', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Browser Stockfish 2', exact: true }).check();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.locator('.analysis-line__moves button').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.analysis-line')).toHaveCount(6, { timeout: 15000 });
  await page.getByRole('button', { name: 'Stop engine', exact: true }).first().click();
  await expect(page.locator('.engine-section__status--running')).toHaveCount(1);
  await page.getByRole('button', { name: 'Refresh analysis', exact: true }).click();
  await expect(page.locator('.engine-section__status--running')).toHaveCount(2);
  await page.locator('.analysis-line__moves button').first().click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.analysis-line')).toHaveCount(6, { timeout: 15000 });
  await expect(page.locator('.engine-error')).toHaveCount(0);
});
test('plays a legal reply using real Stockfish in the browser', async ({ page }) => {
  await configureStockfish(page);
  await page.locator('#black-player').selectOption({ label: 'Browser Stockfish' });
  await page.getByLabel('Clock', { exact: true }).selectOption('blitz');
  await page.getByLabel('Minutes', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await playOpening(page);
  await expect(page.locator('.history-row')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('.history-list')).toContainText('e4');
  await expect(page.locator('.engine-error')).toHaveCount(0);
});
