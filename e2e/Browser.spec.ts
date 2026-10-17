import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { IEnginePlayer, IGame } from '../src/contracts';
import { playMove, square } from './support/BoardInteraction';
import { choosePlayer } from './journeys/play/PlaySetup';

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

async function exportGame(page: Page): Promise<IGame> {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as IGame;
}
async function importStockfishPuzzle(page: Page): Promise<void> {
  await configureStockfish(page);
  await page.getByLabel('Clock', { exact: true }).selectOption('custom');
  await page.getByLabel('Minutes', { exact: true }).fill('1');
  await page.getByLabel('Increment (seconds)', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  const game = await exportGame(page);
  game.metadata.name = 'Stockfish smothered mate in three';
  game.rootPosition.board.fill(undefined);
  for (const [id, kind, colour] of [
    [0, 'king', 'white'], [44, 'queen', 'white'], [53, 'knight', 'white'],
    [62, 'king', 'black'], [61, 'rook', 'black'], [54, 'pawn', 'black'], [55, 'pawn', 'black'],
  ] as const) game.rootPosition.board[id] = { kind, colour } as NonNullable<IGame['rootPosition']['board'][number]>;
  game.rootPosition.castlingAvailability = { whiteKingSide: false, whiteQueenSide: false, blackKingSide: false, blackQueenSide: false };
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await (await pending).setFiles({ name: 'smothered-mate.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(game)) });
  await expect(page.getByRole('heading', { name: game.metadata.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Resume game/ }).click();
}
async function expectStockfishMate(page: Page, engineColour: 'White' | 'Black'): Promise<void> {
  await expect(page.locator('.result-badge')).toHaveText('white won');
  await expect(page.locator('.history-row').last()).toContainText('Nf7#');
  await expect(page.locator('.engine-error')).toHaveCount(0);
  const game = await exportGame(page);
  expect(game.resultState).toBe('whiteWon');
  expect(game.resultReason).toBe('ruleResolved');
  expect(game.livePath).toEqual([0, 0, 0, 0, 0]);
  const player = engineColour === 'White' ? game.whitePlayer : game.blackPlayer;
  expect((player as IEnginePlayer).assignedEngine.executablePath).toBe('stockfish.js');
  expect(game.clockSnapshot.white.isRunning).toBe(false);
  expect(game.clockSnapshot.black.isRunning).toBe(false);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.locator('.result-badge')).toHaveText('white won');
  await expect(page.locator('.history-row')).toHaveCount(5);
  await expect(page.locator('.history-row').last()).toContainText('Nf7#');
}
for (const engineColour of ['Black', 'White'] as const) {
  test(`JRN-PLAY-10 real Stockfish plays smothered mate with engine ${engineColour === 'Black' ? 'losing' : 'winning'}`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await importStockfishPuzzle(page);
    const workerUrls: string[] = [];
    const wasmUrls: string[] = [];
    page.on('worker', (worker) => workerUrls.push(worker.url()));
    page.on('response', (response) => {
      if (response.url().includes('stockfish-19-lite-single.wasm') && response.ok()) wasmUrls.push(response.url());
    });
    await choosePlayer(page, engineColour, 'Browser Stockfish');
    const notation = ['Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'];
    for (const [index, uci] of ['f7h6', 'g8h8', 'e6g8', 'f8g8', 'h6f7'].entries()) {
      const engineTurn = index % 2 === (engineColour === 'White' ? 0 : 1);
      if (!engineTurn) await playMove(page, uci.slice(0, 2), uci.slice(2));
      await expect(page.locator('.history-row').nth(index)).toContainText(notation[index]!, { timeout: 20000 });
      if (engineTurn || index === 4) {
        await expect(page.locator('.history-row')).toHaveCount(index + 1);
        await expect(square(page, uci.slice(2))).toHaveAttribute('aria-label', new RegExp(`${index % 2 === 0 ? 'white' : 'black'} `));
      }
    }
    expect(workerUrls).toEqual(expect.arrayContaining([expect.stringContaining('/stockfish-19-lite-single.js')]));
    expect(wasmUrls.length).toBeGreaterThan(0);
    await expectStockfishMate(page, engineColour);
    expect(errors).toEqual([]);
  });
}
