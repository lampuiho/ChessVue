import { test } from '../../support/TestEvidence';
import { promotionPieces, promotionScenarios } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { saveCurrentGame } from '../../support/GameSave';
import { attemptPromotion, choosePromotion, expectPromotedBoard, expectPromotedGame, openPromotionGame } from './PromotionAction';
for (const scenario of promotionScenarios) for (const { kind } of promotionPieces) {
  test(`JRN-PROMO-03 promotes ${scenario.colour} with capture to ${kind} and preserves notation, material and result`, async ({ page }) => {
    await openPromotionGame(page, scenario);
    const before = await saveCurrentGame(page, 'before');
    await attemptPromotion(page, scenario, true);
    await choosePromotion(page, scenario, kind);
    await expectPromotedBoard(page, scenario, kind, true);
    expectPromotedGame(await saveCurrentGame(page, 'promoted'), before, scenario, kind, true);
  });
}
