import { test, expect, historyTime } from './HistoryTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { addAnalysisEngine, createTimedHistory, nodeAt } from './HistorySetup';

for (const mode of ['untimed', 'timed']) {
  test(`JRN-HIST-05 @smoke explores both colours and an engine prefix in ${mode} analysis then returns live`, async ({ page }) => {
    await openJourney(page, 'history');
    await createTimedHistory(page, mode === 'timed');
    await addAnalysisEngine(page);
    await page.getByRole('button', { name: /Analyse/ }).click();
    const before = await saveCurrentGame(page, 'analysis-anchor');
    await playMove(page, 'g1', 'f3');
    await playMove(page, 'b8', 'c6');
    await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
    await expect(square(page, 'c6')).toHaveAttribute('aria-label', 'c6 black knight');
    await expect(page.locator('.analysis-line').first().getByRole('button')).toHaveCount(4);
    await page.locator('.analysis-line').first().getByRole('button').nth(2).click();
    await expect(page.locator('.history-row')).toHaveCount(7);
    const explored = await saveCurrentGame(page, 'explored');
    expect(explored.livePath).toEqual([0, 0]);
    expect(explored.renderedPath).toHaveLength(7);
    expect(explored.clockSnapshot).toEqual(before.clockSnapshot);
    for (let length = 3; length <= 7; length++) expect(nodeAt(explored, explored.renderedPath.slice(0, length)).kind).toBe('analysis');
    await page.getByRole('button', { name: /Exit analysis/ }).click();
    await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1 white knight');
    await expect(square(page, 'b8')).toHaveAttribute('aria-label', 'b8 black knight');
    const after = await saveCurrentGame(page, 'returned');
    expect(after.renderedPath).toEqual(before.livePath);
    expect(after.moveTree).toEqual(explored.moveTree);
    if (mode === 'timed') {
      await page.clock.setFixedTime(new Date(historyTime.getTime() + 1000));
      await page.clock.runFor(300);
      await expect(page.locator('.player-clock').last()).toContainText('5:01');
    }
  });
}
