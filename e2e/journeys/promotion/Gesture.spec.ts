import { test, expect } from '../../support/TestEvidence';
import { PieceKind } from '../../../src/contracts';
import { promotionGestures, promotionScenarios } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { saveCurrentGame } from '../../support/GameSave';
import { attemptPromotion, choosePromotion, expectPromotedBoard, expectPromotedGame, openPromotionGame, useBlackOrientation } from './PromotionAction';
for (const scenario of promotionScenarios) for (const capture of [false, true]) for (const { gesture, orientation } of promotionGestures) {
  test(`JRN-PROMO-04 promotes ${scenario.colour} ${capture ? 'capture' : 'quiet'} by ${gesture} with ${orientation} orientation`, async ({ page }) => {
    await openPromotionGame(page, scenario);
    if (orientation === 'black') await useBlackOrientation(page);
    else await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', /^a8(?: |$)/);
    const before = await saveCurrentGame(page, 'before');
    const kind = capture ? PieceKind.Rook : PieceKind.Knight;
    await attemptPromotion(page, scenario, capture, gesture);
    await choosePromotion(page, scenario, kind);
    await expectPromotedBoard(page, scenario, kind, capture);
    expectPromotedGame(await saveCurrentGame(page, 'promoted'), before, scenario, kind, capture);
  });
}
