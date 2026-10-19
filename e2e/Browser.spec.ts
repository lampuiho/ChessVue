import { expect, test, type Page } from '@playwright/test';
import type { IEnginePlayer, IGame } from '../src/contracts';
import { playMove, square } from './support/BoardInteraction';
import { choosePlayer } from './journeys/play/PlaySetup';
import { exportGame, playOpening } from './browser/BrowserAction';
import { configureStockfish } from './browser/EngineAction';

test('JRN-SETTINGS-09 real Stockfish continues an untimed game after its profile is removed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await configureStockfish(page);
  await page.locator('#black-player').selectOption({ label: 'Browser Stockfish' });
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Engines', exact: true }).click();
  await page.getByTitle('Delete', { exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await choosePlayer(page, 'Black', 'Keep Browser Stockfish');
  await playOpening(page);
  await expect(page.locator('.history-row')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('.engine-error')).toHaveCount(0);
  const game = await exportGame(page);
  expect(game.timeControl.preset).toBe('untimed');
  expect(game.clockSnapshot.white.remainingMs).toBeUndefined();
  expect((game.blackPlayer as IEnginePlayer).assignedEngine.executablePath).toBe('stockfish.js');
  expect(errors).toEqual([]);
});
async function importStockfishPuzzle(page: Page) {
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
async function expectStockfishMate(page: Page, engineColour: 'White' | 'Black') {
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
