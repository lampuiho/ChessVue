import { test, expect } from './BrowserTest';
import { configureStockfish, replayLegalMoves } from './EngineAction';
import { exportGame, playOpening } from './BrowserAction';
import { browserGame, gameId } from './BrowserStorage';
import type { IGame, IMove } from '../../src/contracts';
import { StockfishConfig } from '../../src/config/StockfishConfig';
import { browserReplyReloads } from '../../journeys/definitions/browser/data/BrowserScenario';

async function createTimedGame(page: import('@playwright/test').Page) {
  await configureStockfish(page);
  await page.locator('#black-player').selectOption({ label: 'Browser Stockfish' });
  await page.getByLabel('Clock', { exact: true }).selectOption('blitz');
  await page.getByLabel('Minutes', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
}
function expectReply(game: IGame) {
  expect(game.timeControl).toMatchObject({ preset: 'blitz', initialMs: 60000 });
  expect(game.livePath).toEqual([0, 0]);
  expect(game.renderedPath).toEqual(game.livePath);
  const white = game.moveTree.root.children[0]!;
  const black = white.children[0]!;
  expect(white.children).toHaveLength(1);
  expect(black.children).toHaveLength(0);
  expect(white.move).toMatchObject({ from: 12, to: 28, movingColour: 'white' });
  expect(black.move?.movingColour).toBe('black');
  expect(replayLegalMoves(game, [white.move!, black.move!] as IMove[]).sideToMove).toBe('white');
  expect(game.resultState).toBe('ongoing');
  for (const clock of [game.clockSnapshot.white, game.clockSnapshot.black]) {
    expect(clock.remainingMs).toBeGreaterThan(0);
    expect(clock.remainingMs).toBeLessThanOrEqual(60000);
  }
}
for (const reload of browserReplyReloads) {
  test(`JRN-BROWSER-04 commits one legal timed Stockfish reply across reload ${reload}`, async ({ page }) => {
    const gate = Promise.withResolvers<void>();
    const requested = Promise.withResolvers<void>();
    const pattern = `**/${StockfishConfig.wasmFile}`;
    try {
      await createTimedGame(page);
      if (reload === 'while reply is due') await page.route(pattern, async (route) => {
        requested.resolve();
        await gate.promise;
        await route.continue().catch(() => {});
      }, { times: 1 });
      await playOpening(page);
      const id = gameId(page);
      if (reload === 'while reply is due') {
        await requested.promise;
        await expect.poll(async () => (await browserGame(page, id))?.livePath).toEqual([0]);
      } else {
        await expect(page.locator('.history-row')).toHaveCount(2, { timeout: 20000 });
        await expect.poll(async () => (await browserGame(page, id))?.livePath).toEqual([0, 0]);
      }
      await page.reload();
      gate.resolve();
      await expect(page.locator('.history-row')).toHaveCount(2, { timeout: 20000 });
      await expect(page.locator('.player-clock--running')).toHaveCount(1);
      await expect.poll(async () => (await browserGame(page, id))?.livePath).toEqual([0, 0]);
      const game = await exportGame(page);
      expectReply(game);
      await expect(page.locator('.engine-error')).toHaveCount(0);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page).toHaveURL(/\/game\/.+/);
      await page.reload();
      await expect(page.locator('.history-row')).toHaveCount(2);
      const restored = await exportGame(page);
      expectReply(restored);
      expect(restored.moveTree).toEqual(game.moveTree);
    } finally {
      gate.resolve();
      await page.unroute(pattern);
    }
  });
}
