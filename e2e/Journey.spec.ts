import { expect, test, type Page } from '@playwright/test';

async function openJourney(page: Page, name: string): Promise<void> {
  await page.goto('/?journey=' + name + '&reset=1');
  await page.waitForFunction(() => window.chessVueJourney?.ready);
  await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'false');
}
for (const name of ['fresh', 'play', 'history', 'setup', 'promotion', 'analysis', 'clocks', 'saves', 'settings', 'recovery']) {
  test('boots the ' + name + ' journey in a browser', async ({ page }) => {
    await openJourney(page, name);
    await expect(page.locator('.app-loading')).toHaveCount(0);
    if (name === 'analysis') await expect(page.locator('.analysis-line')).toHaveCount(6);
  });
}
test('makes a move through the fresh journey UI', async ({ page }) => {
  await openJourney(page, 'fresh');
  await page.getByRole('button', { name: /Quick game/ }).click();
  await page.getByRole('button', { name: /^e2 / }).click();
  await page.getByRole('button', { name: 'e4', exact: true }).click();
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
  await expect(page.locator('.history-list')).toContainText('e4');
});
test('exports and reimports a seeded game using journey dialog choices', async ({ page }) => {
  await openJourney(page, 'saves');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.evaluate(() => window.chessVueJourney.chooseExport('exports/round-trip.json'));
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.chessVueJourney.readFile('exports/round-trip.json'))).toBeTruthy();
  const exported = await page.evaluate(() => JSON.parse(window.chessVueJourney.readFile('exports/round-trip.json')!));
  expect(exported.schemaVersion).toBe(1);
  expect(exported.metadata.id).toBe('save-library');
  await page.evaluate(() => window.chessVueJourney.chooseImport('exports/round-trip.json'));
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
  await expect(page.getByRole('button', { name: /^f3 white knight$/i })).toBeVisible();
});
