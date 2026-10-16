import { test, expect } from './SetupTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { addAnalysisEngine, expectFreeWorkspace, finishEditing, selectSetupBoard } from './SetupAction';

test('JRN-SETUP-06 retains an assignment during editing and analyses only the finished position', async ({ page }) => {
  await openJourney(page, 'setup');
  await selectSetupBoard(page);
  await addAnalysisEngine(page);
  await expect(page.locator('.engine-section')).toContainText('Journey A');
  await expect(page.locator('.analysis-line')).toHaveCount(0);
  await expect(page.getByTitle('Refresh analysis', { exact: true })).toBeDisabled();
  await square(page, 'a3').click();
  await square(page, 'a3').click();
  await square(page, 'd5').locator('.chess-piece').dragTo(square(page, 'd6'));
  const editing = await saveCurrentGame(page, 'assigned-edit');
  expect(editing.analysis.seats).toHaveLength(1);
  expect(editing.analysis.seats[0]!.lines).toEqual([]);
  await finishEditing(page);
  await expect(page.locator('.analysis-line')).toHaveCount(3);
  await expect(square(page, 'd6')).toHaveAttribute('aria-label', 'd6 white pawn');
  const analysed = await saveCurrentGame(page, 'analysed');
  expectFreeWorkspace(analysed);
  expect(analysed.rootPosition).toEqual(editing.rootPosition);
  expect(analysed.analysis.seats[0]!.assignedEngine).toEqual(editing.analysis.seats[0]!.assignedEngine);
  expect(analysed.analysis.seats[0]!.lines[0]!.pv[0]!.movingColour).toBe('white');
  await expect(page.locator('.history-row')).toHaveCount(0);
});

test('JRN-SETUP-06 preserves an edited board when its assigned analysis engine cannot start', async ({ page }) => {
  await openJourney(page, 'setup');
  await selectSetupBoard(page);
  await addAnalysisEngine(page, 'Journey unavailable');
  await square(page, 'a3').click();
  const before = await saveCurrentGame(page, 'before-engine-failure');
  await finishEditing(page);
  await expect(page.locator('.engine-error')).toHaveText('Process failed to start: journey://unavailable.');
  await expect(page.getByTitle('Retry engine', { exact: true })).toBeEnabled();
  const after = await saveCurrentGame(page, 'after-engine-failure');
  expectFreeWorkspace(after);
  expect(after.rootPosition).toEqual(before.rootPosition);
  expect(after.moveTree).toEqual(before.moveTree);
  expect(after.analysis.seats[0]!.lines).toEqual([]);
  await page.getByTitle('Remove engine', { exact: true }).click();
  await addAnalysisEngine(page);
  await expect(page.locator('.analysis-line')).toHaveCount(3);
  await expect(page.locator('.engine-error')).toHaveCount(0);
});
