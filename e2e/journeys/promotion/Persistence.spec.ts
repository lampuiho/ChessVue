import { test, expect } from '../../support/TestEvidence';
import type { Page } from '@playwright/test';
import { PieceKind, type IGame } from '../../../src/contracts';
import { promotionScenarios, type IPromotionScenario } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { square } from '../../support/BoardInteraction';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { readFile } from '../../support/SaveInspection';
import { attemptPromotion, choosePromotion, expectPromotedBoard, expectPromotedGame, openPromotionGame } from './PromotionAction';
async function takeBackPromotion(page: Page, scenario: IPromotionScenario, before: IGame) {
  await page.getByRole('button', { name: /Takeback/ }).click();
  await expect(square(page, scenario.from)).toHaveAttribute('aria-label', `${scenario.from} ${scenario.colour} pawn`);
  await expect(square(page, scenario.quiet)).toHaveAttribute('aria-label', scenario.quiet);
  await expect(square(page, scenario.capture)).toHaveAttribute('aria-label', `${scenario.capture} ${scenario.opponent} rook`);
  await expect(page.locator('.history-row')).toHaveCount(0);
  await expect(page.getByLabel('Captured material')).toHaveCount(0);
  await expect(page.locator('.result-badge')).toHaveText(`${scenario.colour} to move`);
  await expect(page.getByRole('button', { name: /Takeback/ })).toBeDisabled();
  const rewound = await saveCurrentGame(page, 'rewound');
  expect({ ...rewound, metadata: before.metadata }).toEqual(before);
}
for (const scenario of promotionScenarios) for (const capture of [false, true]) {
  test(`JRN-PROMO-05 restores ${scenario.colour} ${capture ? 'capture' : 'quiet'} underpromotion then takes back to the original position`, async ({ page }) => {
    await openPromotionGame(page, scenario);
    const before = await saveCurrentGame(page, 'before');
    const kind = capture ? PieceKind.Knight : PieceKind.Rook;
    await attemptPromotion(page, scenario, capture);
    await choosePromotion(page, scenario, kind);
    await expectPromotedBoard(page, scenario, kind, capture);
    const saved = await saveCurrentGame(page, 'promoted');
    expectPromotedGame(saved, before, scenario, kind, capture);
    const path = `saves/promotion-${scenario.colour}/promoted.json`;
    const bytes = await readFile(page, path);
    await page.reload();
    await waitForJourney(page);
    await expect(page).toHaveURL(new RegExp('/game/promotion-' + scenario.colour + '$'));
    await expectPromotedBoard(page, scenario, kind, capture);
    const restored = await saveCurrentGame(page, 'restored');
    expect({ ...restored, metadata: saved.metadata }).toEqual(saved);
    await takeBackPromotion(page, scenario, before);
    expect(await readFile(page, path)).toBe(bytes);
    await attemptPromotion(page, scenario, capture);
    await choosePromotion(page, scenario, PieceKind.Bishop);
    await expectPromotedBoard(page, scenario, PieceKind.Bishop, capture);
  });
}
