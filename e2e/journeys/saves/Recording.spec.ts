import { test, expect } from './SaveTest';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { expectCanonical } from './SaveAction';
import { createRecordedWorkspace, reviewRecordedMove } from './RecordedAction';
test('JRN-SAVE-15 restores actual-move records after subsequent play and temporary branch pruning', async ({ page }) => {
  const saved = await createRecordedWorkspace(page);
  await page.reload();
  await waitForJourney(page);
  await expect(page.locator('.history-row')).toHaveCount(7);
  expectCanonical(await saveCurrentGame(page, 'Restored recording'), saved);
  await reviewRecordedMove(page);
});
