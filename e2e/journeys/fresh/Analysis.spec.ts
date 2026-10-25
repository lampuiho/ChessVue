import { test, expect } from '../../support/TestEvidence';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove } from '../../support/BoardInteraction';
import { createWorkspace, openCustomGame, setCustomClock } from '../../support/GameCreation';
import { configureEngines } from '../../support/EngineInventory';
import { saveCurrentGame } from '../../support/GameSave';

for (const mode of ['Free analysis', 'White unassigned', 'Black unassigned']) {
  test(`JRN-FRESH-07 explores without live work using ${mode}`, async ({ page }) => {
    await openJourney(page, 'fresh');
    const dialog = await openCustomGame(page);
    await setCustomClock(dialog);
    if (mode === 'Free analysis') await dialog.getByRole('button', { name: mode, exact: true }).click();
    else await dialog.getByLabel(mode.split(' ')[0]!, { exact: true }).selectOption('none');
    await createWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Study controls', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit board/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pause/ })).toHaveCount(0);
    await playMove(page, 'e2', 'e4');
    await playMove(page, 'e7', 'e5');
    await expect(page.locator('.history-row')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^e5 black pawn$/i })).toBeVisible();
    const game = await saveCurrentGame(page, 'Study');
    expect(game.livePath).toBeUndefined();
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    expect(game.clockSnapshot.black.isRunning).toBe(false);
    expect(game.analysis.seats).toEqual([]);
    expect(game.renderedPath).toEqual([0, 0]);
  });
}
test('JRN-FRESH-08 refreshes two analysis engines after an exploratory move', async ({ page }) => {
  await openJourney(page, 'fresh');
  await configureEngines(page, [{ name: 'Journey A', path: 'journey://a' }, { name: 'Journey B', path: 'journey://b' }]);
  const dialog = await openCustomGame(page);
  await dialog.getByRole('button', { name: 'Free analysis', exact: true }).click();
  await dialog.getByLabel('Add analysis engine', { exact: true }).selectOption({ label: 'Journey A' });
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await dialog.getByLabel('Add analysis engine', { exact: true }).selectOption({ label: 'Journey B' });
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await createWorkspace(page);
  await expect(page.locator('.analysis-line')).toHaveCount(6);
  const previous = await page.locator('.analysis-line').allTextContents();
  await playMove(page, 'e2', 'e4');
  await expect(page.locator('.analysis-line')).toHaveCount(6);
  await expect.poll(() => page.locator('.analysis-line').allTextContents()).not.toEqual(previous);
  await expect(page.locator('.history-row')).toHaveCount(1);
  const game = await saveCurrentGame(page, 'Engine study');
  expect(game.livePath).toBeUndefined();
  expect(game.clockSnapshot.white.isRunning).toBe(false);
  expect(game.clockSnapshot.black.isRunning).toBe(false);
  expect(game.analysis.seats.map((seat) => seat.assignedEngine.displayName)).toEqual(['Journey A', 'Journey B']);
  for (const seat of game.analysis.seats) {
    expect(seat.lines).toHaveLength(3);
    expect(seat.lines.every((line) => line.pv[0]?.movingColour === 'black')).toBe(true);
  }
});
