import { test, expect } from './HistoryTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { selectGame } from '../../support/GameNavigation';
import { saveCurrentGame } from '../../support/GameSave';
import { historyRow, nodeAt, returnLive } from './HistorySetup';

for (const preference of ['Return to live position', 'Stay on analysis branch']) {
  test(`JRN-HIST-04 explores with takebacks disabled using ${preference}`, async ({ page }) => {
    await openJourney(page, 'history');
    await selectGame(page, 'history-blocked', 'Takeback blocked');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Gameplay', exact: true }).click();
    await page.getByLabel('After exploring history', { exact: false }).selectOption({ label: preference });
    await page.getByRole('button', { name: preference.startsWith('Return') ? 'Back to game' : 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/history-blocked$/);
    const before = await saveCurrentGame(page, 'before-branch');
    await historyRow(page, 'e5').click();
    await playMove(page, 'f1', 'c4');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const after = await saveCurrentGame(page, 'after-branch');
    expect(after.livePath).toEqual(before.livePath);
    expect(after.resultState).toBe(before.resultState);
    expect(after.clockSnapshot).toEqual(before.clockSnapshot);
    expect(nodeAt(after, [0, 0]).mainlineChildIndex).toBe(0);
    expect(nodeAt(after, [0, 0]).children.slice(0, 2)).toEqual(nodeAt(before, [0, 0]).children);
    expect(nodeAt(after, [0, 0, 2]).kind).toBe('analysis');
    expect(after.renderedPath).toEqual(preference.startsWith('Return') ? before.livePath : [0, 0, 2]);
    if (preference.startsWith('Stay')) await returnLive(page);
    await expect(square(page, 'b5')).toHaveAttribute('aria-label', 'b5 white bishop');
  });
}
