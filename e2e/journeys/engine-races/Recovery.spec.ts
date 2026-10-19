import { test, expect } from './RaceTest';
import { openAnalysisRace, analysisSeat, release, emit, latestSearch } from './RaceAction';
import { saveCurrentGame } from '../../support/GameSave';
import { addEngine } from '../analysis/AnalysisAction';
test('JRN-RACE-06 recovers a crash isolates repeated retry failures and permits manual replacement', async ({ page }) => {
  const [a, b] = await openAnalysisRace(page);
  await release(page, a!.id);
  await release(page, b!.id);
  await page.evaluate((id) => window.chessVueJourney.engines.crash(id), a!.processId);
  await analysisSeat(page).getByRole('button', { name: 'Stop engine', exact: true }).click();
  await expect(analysisSeat(page).getByRole('button', { name: 'Retry engine', exact: true })).toBeVisible();
  await analysisSeat(page).getByRole('button', { name: 'Retry engine', exact: true }).click();
  const recovered = await latestSearch(page, 'analysis', 'journey://a', b!.id);
  await release(page, recovered.id);
  await expect(analysisSeat(page).locator('.analysis-line')).toHaveCount(3);
  await emit(page, a!.id, 'info depth 90 score cp 999 pv g1f3');
  await expect(analysisSeat(page).locator('.engine-section__score')).toHaveText('+0.24');
  await page.evaluate((id) => {
    window.chessVueJourney.engines.crash(id);
    window.chessVueJourney.engines.failNext('journey://a', 3);
  }, recovered.processId);
  await analysisSeat(page).getByRole('button', { name: 'Stop engine', exact: true }).click();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await analysisSeat(page).getByRole('button', { name: 'Retry engine', exact: true }).click();
    await expect(analysisSeat(page).locator('.engine-error')).toContainText('Process failed to start');
    await expect(analysisSeat(page).getByRole('button', { name: 'Retry engine', exact: true })).toBeEnabled();
  }
  await emit(page, b!.id, 'info depth 31 score cp 66 pv g1f3 b8c6');
  await expect(analysisSeat(page, 'Journey B').locator('.engine-section__score')).toHaveText('+0.66');
  await analysisSeat(page).getByRole('button', { name: 'Remove engine', exact: true }).click();
  await addEngine(page, 'Journey A');
  const replaced = await latestSearch(page, 'analysis', 'journey://a', recovered.id);
  await release(page, replaced.id);
  const saved = await saveCurrentGame(page, 'manual-recovery');
  expect(saved.analysis.seats.map((seat) => seat.assignedEngine.displayName)).toEqual(['Journey B', 'Journey A']);
  expect(saved.analysis.seats.map((seat) => seat.lines[0]!.depth)).toEqual([31, 12]);
  expect(saved.renderedPath).toEqual([0, 0]);
});
