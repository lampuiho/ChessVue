import { test, expect, historyTime } from './HistoryTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { addAnalysisEngine, createTimedHistory } from './HistorySetup';

for (const reason of ['manual', 'menu']) {
  test(`JRN-HIST-07 layers a ${reason} pause over analysis without removing its ownership`, async ({ page }) => {
    await openJourney(page, 'history');
    await createTimedHistory(page);
    await addAnalysisEngine(page);
    await page.getByRole('button', { name: /Analyse/ }).click();
    await playMove(page, 'g1', 'f3');
    const before = await saveCurrentGame(page, 'before-pause');
    if (reason === 'manual') await page.getByRole('button', { name: /^Pause/ }).click();
    else await page.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(square(page, 'b8')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start position', exact: true })).toBeDisabled();
    await expect(page.locator('.history-row').first()).toBeDisabled();
    await expect(page.locator('.analysis-line').first().getByRole('button').first()).toBeDisabled();
    await page.clock.setFixedTime(new Date(historyTime.getTime() + 60000));
    await page.clock.runFor(300);
    if (reason === 'manual') await page.getByRole('button', { name: /Resume game/ }).click();
    else await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Analysis mode', exact: true })).toBeVisible();
    await expect(square(page, 'b8')).toBeEnabled();
    const resumed = await saveCurrentGame(page, 'resumed-analysis');
    expect(resumed.clockSnapshot).toEqual(before.clockSnapshot);
    expect(resumed.livePath).toEqual(before.livePath);
    expect(resumed.moveTree).toEqual(before.moveTree);
    await playMove(page, 'b8', 'c6');
    await page.getByRole('button', { name: /Exit analysis/ }).click();
    await expect(page.getByRole('heading', { name: 'Game controls', exact: true })).toBeVisible();
    const exited = await saveCurrentGame(page, 'exited');
    expect(exited.livePath).toEqual(before.livePath);
    expect(exited.clockSnapshot.white.remainingMs).toBe(before.clockSnapshot.white.remainingMs);
  });
}
