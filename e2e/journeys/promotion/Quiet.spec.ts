import { test } from '../../support/TestEvidence';
import { promotionPieces, promotionScenarios } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { saveCurrentGame } from '../../support/GameSave';
import { attemptPromotion, choosePromotion, expectPromotedBoard, expectPromotedGame, openPromotionGame } from './PromotionAction';
for (const scenario of promotionScenarios) for (const { kind } of promotionPieces) {
  test(`JRN-PROMO-02 @smoke promotes ${scenario.colour} quietly to ${kind} exactly once`, async ({ page }) => {
    await openPromotionGame(page, scenario);
    const before = await saveCurrentGame(page, 'before');
    await attemptPromotion(page, scenario, false);
    await choosePromotion(page, scenario, kind);
    await expectPromotedBoard(page, scenario, kind, false);
    expectPromotedGame(await saveCurrentGame(page, 'promoted'), before, scenario, kind, false);
  });
}
