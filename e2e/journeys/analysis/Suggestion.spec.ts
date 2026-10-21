import { test, expect, analysisTime } from './AnalysisTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { selectGame } from '../../support/GameNavigation';
import { saveCurrentGame } from '../../support/GameSave';
import { analysisSeat, createTimedAnalysis, expectMoveBoard, expectOutput, expectPrefix, selectAnalysisGame } from './AnalysisAction';
for (const context of ['live', 'in-game analysis', 'history']) {
  test(`JRN-ANALYSIS-03 shows compact evaluations without folds in ${context}`, async ({ page }) => {
    await openJourney(page, 'analysis');
    await selectAnalysisGame(page, false);
    if (context === 'in-game analysis') await page.getByRole('button', { name: /Analyse/ }).click();
    if (context === 'history') await page.getByRole('button', { name: 'Start position', exact: true }).click();
    for (const [index, name] of ['Journey A', 'Journey B'].entries()) {
      await expect(analysisSeat(page, name).locator('.engine-section__score')).toHaveText(index ? '+0.36' : '+0.24');
      await expect(analysisSeat(page, name).locator('.engine-section__name')).toHaveText(name);
      await expect(analysisSeat(page, name).locator('.engine-section__fold, .engine-summary, .analysis-line')).toHaveCount(0);
      await expect(analysisSeat(page, name).getByRole('button', { name: /^Play through/ })).toHaveCount(0);
    }
    await expect(page.locator('.analysis-panel h2')).toHaveText('Evaluations');
    await expect(page.locator('.analysis-panel .side-panel__collapse')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Recorded analysis', exact: true })).toHaveCount(0);
    await selectAnalysisGame(page);
    if (context === 'in-game analysis') await page.getByRole('button', { name: /Analyse/ }).click();
    if (context === 'history') await page.getByRole('button', { name: 'Start position', exact: true }).click();
    await expectOutput(page);
    await expect(page.locator('.analysis-panel h2')).toHaveText('Analysis');
    await expect(analysisSeat(page).getByRole('button', { name: /^Play through/ }).first()).toBeEnabled();
  });
}
for (const context of ['free', 'in-game', 'timed in-game']) for (const length of [1, 3]) {
  test(`JRN-ANALYSIS-04 plays exactly ${length} suggested move${length === 1 ? '' : 's'} in ${context} analysis`, async ({ page }) => {
    await openJourney(page, 'analysis');
    if (context !== 'free') {
      if (context === 'timed in-game') await createTimedAnalysis(page);
      else await selectAnalysisGame(page);
      await page.getByRole('button', { name: /Analyse/ }).click();
      await expect(page.getByRole('heading', { name: 'Analysis mode', exact: true })).toBeVisible();
    }
    await expectOutput(page);
    const before = await saveCurrentGame(page, 'prefix-anchor');
    const prefix = before.analysis.seats[0]!.lines[0]!.pv.slice(0, length);
    await page.clock.pauseAt(new Date(analysisTime.getTime() + 60000));
    await analysisSeat(page).locator('.analysis-line').first().getByRole('button').nth(length - 1).click();
    await expect(page.locator('.history-row')).toHaveCount(3);
    if (length > 1) {
      await expect(page.locator('.board-square').first()).toBeDisabled();
      await page.clock.runFor(349);
      await expect(page.locator('.history-row')).toHaveCount(3);
      await page.clock.runFor(351);
    }
    await expect(page.locator('.history-row')).toHaveCount(2 + length);
    await expectMoveBoard(page, prefix[length - 1]!);
    await page.clock.runFor(1000);
    const after = await saveCurrentGame(page, 'selected-prefix');
    expectPrefix(after, before.renderedPath, prefix, 'analysis');
    expect(after.livePath).toEqual(before.livePath);
    expect(after.clockSnapshot).toEqual(before.clockSnapshot);
    if (context !== 'free') {
      await page.getByRole('button', { name: /Exit analysis/ }).click();
      await expect(page.locator('.result-badge')).toHaveText('white to move');
      const returned = await saveCurrentGame(page, 'returned-live');
      expect(returned.renderedPath).toEqual(before.livePath);
      expect(returned.moveTree).toEqual(after.moveTree);
    }
  });
}
test('JRN-ANALYSIS-05 submits only the first suggestion when a later live PV move is clicked', async ({ page }) => {
  await openJourney(page, 'analysis');
  await selectAnalysisGame(page);
  await expectOutput(page);
  const before = await saveCurrentGame(page, 'live-anchor');
  const first = before.analysis.seats[1]!.lines[0]!.pv[0]!;
  await analysisSeat(page, 'Journey B').locator('.analysis-line').first().getByRole('button').nth(3).click();
  await expectMoveBoard(page, first);
  await page.clock.runFor(2000);
  await expect(page.locator('.history-row')).toHaveCount(3);
  const after = await saveCurrentGame(page, 'single-live-turn');
  expectPrefix(after, before.livePath!, [first], 'live');
  expect(after.livePath).toEqual(after.renderedPath);
  expect(after.clockSnapshot).toEqual(before.clockSnapshot);
});
test('JRN-ANALYSIS-06 cancels remaining PV playback when switching games', async ({ page }) => {
  await openJourney(page, 'analysis');
  await expectOutput(page);
  await page.clock.pauseAt(new Date(analysisTime.getTime() + 60000));
  const before = await saveCurrentGame(page, 'switch-anchor');
  await analysisSeat(page).locator('.analysis-line').first().getByRole('button').nth(3).click();
  await expect(page.locator('.history-row')).toHaveCount(3);
  await selectAnalysisGame(page);
  await page.clock.runFor(2000);
  await expect(page.locator('.history-row')).toHaveCount(2);
  const other = await saveCurrentGame(page, 'other-unchanged');
  expect(other.livePath).toEqual([0, 0]);
  expect(other.renderedPath).toEqual([0, 0]);
  await selectGame(page, 'analysis-free', 'Free analysis with two engines');
  await page.clock.runFor(1000);
  await expect(page.locator('.history-row')).toHaveCount(3);
  const stopped = await saveCurrentGame(page, 'cancelled-prefix');
  expectPrefix(stopped, before.renderedPath, before.analysis.seats[0]!.lines[0]!.pv.slice(0, 1), 'analysis');
});
