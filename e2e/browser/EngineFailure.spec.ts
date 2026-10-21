import { test, expect } from './BrowserTest';
import { configureEngines, createAnalysis, engineSection, expectAnalysis, expectCurrentAnalysis } from './EngineAction';
import { exportGame, playOpening } from './BrowserAction';
import { playMove } from '../support/BoardInteraction';
import { StockfishConfig } from '../../src/config/StockfishConfig';
import { browserEngineFailures } from '../../journeys/definitions/browser/data/BrowserScenario';

async function _expectLocalPlay(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  await page.getByRole('button', { name: 'Quick game', exact: true }).click();
  await playOpening(page);
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.result-badge')).toHaveText('black to move');
}
for (const failure of browserEngineFailures) {
  test(`JRN-BROWSER-05 isolates ${failure.name} failure while local play and another real worker continue`, async ({ page }) => {
    if (failure.name === 'unavailable worker') await page.route('**/engines/unavailable.js', (route) => route.fulfill({ status: 404, body: 'Worker unavailable' }));
    if (failure.name === 'unavailable WASM') {
      const response = await page.request.get(`/engines/stockfish/${StockfishConfig.workerFile}`);
      expect(response.ok()).toBe(true);
      const script = await response.body();
      await page.route(`**/engines/broken/${StockfishConfig.workerFile}`, (route) => route.fulfill({ contentType: 'text/javascript', body: script }));
      await page.route('**/engines/broken/*.wasm', (route) => route.abort('failed'));
    }
    await configureEngines(page, [{ name: 'Healthy Stockfish', path: 'stockfish.js' }, { name: 'Faulty engine', path: failure.path }]);
    await createAnalysis(page, ['Healthy Stockfish', 'Faulty engine']);
    const faulty = engineSection(page, 'Faulty engine');
    await expect(faulty.locator('.engine-error')).toContainText(failure.error, { timeout: 20000 });
    await expect(faulty.getByRole('button', { name: 'Retry engine', exact: true })).toBeVisible();
    await expectAnalysis(page, ['Healthy Stockfish']);
    const healthy = page.workers().find((worker) => worker.url().includes('/engines/stockfish/'))!;
    expect(healthy).toBeTruthy();
    await playMove(page, 'e2', 'e4');
    await expect(page.locator('.history-row')).toHaveCount(1);
    await expectAnalysis(page, ['Healthy Stockfish']);
    expect(page.workers()).toContain(healthy);
    await faulty.getByRole('button', { name: 'Remove engine', exact: true }).click();
    await expect(page.locator('.engine-section')).toHaveCount(1);
    await expect(page.locator('.engine-error')).toHaveCount(0);
    expectCurrentAnalysis(await exportGame(page));
    await _expectLocalPlay(page);
  });
}
