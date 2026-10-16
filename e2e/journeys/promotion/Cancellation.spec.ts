import { test, expect } from '../../support/TestEvidence';
import { promotionScenarios } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { attemptPromotion, openPromotionGame, promotionChooser } from './PromotionAction';
for (const scenario of promotionScenarios) for (const capture of [false, true]) {
  test(`JRN-PROMO-01 cancels ${scenario.colour} ${capture ? 'capture' : 'quiet'} promotion without mutation and permits another move`, async ({ page }) => {
    await openPromotionGame(page, scenario);
    const before = await saveCurrentGame(page, 'before-cancel');
    const board = await page.locator('.board-square').evaluateAll((squares) => squares.map((square) => square.getAttribute('aria-label')));
    const files = await page.evaluate(() => Object.fromEntries(window.chessVueJourney.listFiles().map((path) => [path, window.chessVueJourney.readFile(path)])));
    await attemptPromotion(page, scenario, capture);
    await promotionChooser(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(promotionChooser(page)).toHaveCount(0);
    expect(await page.locator('.board-square').evaluateAll((squares) => squares.map((square) => square.getAttribute('aria-label')))).toEqual(board);
    await expect(page.locator('.history-row')).toHaveCount(0);
    await expect(page.getByLabel('Captured material')).toHaveCount(0);
    await expect(page.locator('.result-badge')).toHaveText(`${scenario.colour} to move`);
    expect(await page.evaluate(() => Object.fromEntries(window.chessVueJourney.listFiles().map((path) => [path, window.chessVueJourney.readFile(path)])))).toEqual(files);
    const cancelled = await saveCurrentGame(page, 'cancelled');
    expect({ ...cancelled, metadata: before.metadata }).toEqual(before);
    await playMove(page, scenario.kingFrom, scenario.kingTo);
    await expect(square(page, scenario.kingTo)).toHaveAttribute('aria-label', `${scenario.kingTo} ${scenario.colour} king`);
    await expect(square(page, scenario.from)).toHaveAttribute('aria-label', `${scenario.from} ${scenario.colour} pawn`);
    await expect(page.locator('.history-row')).toHaveCount(1);
    await expect(page.locator('.result-badge')).toHaveText(`${scenario.opponent} to move`);
  });
}
