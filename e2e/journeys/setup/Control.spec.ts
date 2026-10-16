import { test, expect } from './SetupTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { addAnalysisEngine, finishEditing } from './SetupAction';

test('JRN-SETUP-05 blocks history, players, gameplay and analysis starts while editing', async ({ page }) => {
  await openJourney(page, 'setup');
  await addAnalysisEngine(page, 'Journey unavailable');
  await expect(page.getByTitle('Retry engine', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /Edit board/ }).click();
  const before = await saveCurrentGame(page, 'locked');
  await expect(page.locator('.history-row')).toHaveCount(3);
  for (const control of await page.locator('.history-row, .history-start, .player-name').all()) await expect(control).toBeDisabled();
  await expect(page.getByTitle('Refresh analysis', { exact: true })).toBeDisabled();
  await expect(page.getByTitle('Retry engine', { exact: true })).toHaveCount(0);
  await expect(page.locator('.control-grid .control-button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Takeback|Start game|Resign|Offer draw|Pause|Analyse/ })).toHaveCount(0);
  await expect(page.locator('.analysis-line__moves button')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await saveCurrentGame(page, 'still-locked');
  expect(after.moveTree).toEqual(before.moveTree);
  expect(after.rootPosition).toEqual(before.rootPosition);
  expect(after.analysis).toEqual(before.analysis);
  await finishEditing(page);
  await expect(page.getByRole('button', { name: 'Start position', exact: true })).toBeEnabled();
  await expect(page.locator('.player-name').first()).toBeEnabled();
});
