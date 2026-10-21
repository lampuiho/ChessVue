import { expect, type Page } from '@playwright/test';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { nodeAt, openLibraryGame, setAutosaveInterval } from './SaveAction';
async function _addEngine(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await dialog.getByRole('radio', { name: new RegExp(name + ' ') }).check();
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
}
export async function expectRecordedOutput(page: Page) {
  for (const name of ['Journey A', 'Journey B']) {
    const seat = page.locator('.analysis-panel .engine-section').filter({ has: page.getByText(name, { exact: true }) });
    await expect(seat.locator('.engine-section__name')).toHaveAttribute('title', 'Evaluating position');
    await expect(seat.locator('.engine-section__score')).toHaveText(name === 'Journey A' ? '+0.24' : '+0.36');
  }
}
async function _stopOutput(page: Page) {
  while (await page.getByRole('button', { name: 'Stop engine', exact: true }).count()) {
    await page.locator('.engine-section').filter({ has: page.getByRole('button', { name: 'Stop engine', exact: true }) }).first().hover();
    await page.getByRole('button', { name: 'Stop engine', exact: true }).first().click();
  }
}
export async function createRecordedWorkspace(page: Page) {
  await openLibraryGame(page);
  await setAutosaveInterval(page, 0);
  await _addEngine(page, 'Journey A');
  await _addEngine(page, 'Journey B');
  await expectRecordedOutput(page);
  await _stopOutput(page);
  const parent = await saveCurrentGame(page, 'Evaluated parent');
  await playMove(page, 'f1', 'b5');
  await expectRecordedOutput(page);
  await playMove(page, 'a7', 'a6');
  await expectRecordedOutput(page);
  const recorded = await saveCurrentGame(page, 'Recorded moves');
  const record = nodeAt(recorded, [0, 0, 0, 0, 0]).recordedAnalysis!;
  expect(record.seats).toHaveLength(2);
  expect(record.seats).toEqual(parent.analysis.seats);
  expect(nodeAt(recorded, recorded.livePath!).recordedAnalysis?.seats).toHaveLength(2);
  await _exploreAndPrune(page, recorded);
  await _stopOutput(page);
  const saved = await saveCurrentGame(page, 'Recorded workspace');
  expect(nodeAt(saved, [0, 0, 0, 0, 0]).recordedAnalysis).toEqual(record);
  expect(nodeAt(saved, [0, 0, 0, 0, 0, 0]).children).toHaveLength(1);
  expect(nodeAt(saved, saved.livePath!).kind).toBe('live');
  return saved;
}
async function _exploreAndPrune(page: Page, recorded: Awaited<ReturnType<typeof saveCurrentGame>>) {
  await page.getByRole('button', { name: /^Analyse Explore/ }).click();
  await playMove(page, 'b5', 'a4');
  await playMove(page, 'g8', 'f6');
  const explored = await saveCurrentGame(page, 'Temporary exploration');
  expect(explored.livePath).toEqual(recorded.livePath);
  for (const length of [7, 8]) expect(nodeAt(explored, explored.renderedPath.slice(0, length)).recordedAnalysis).toBeUndefined();
  expect(nodeAt(explored, [0, 0, 0, 0, 0]).recordedAnalysis).toEqual(nodeAt(recorded, [0, 0, 0, 0, 0]).recordedAnalysis);
  await page.getByRole('button', { name: /^Exit analysis/ }).click();
  await expectRecordedOutput(page);
  await playMove(page, 'd2', 'd3');
  await expectRecordedOutput(page);
}
export async function reviewRecordedMove(page: Page) {
  await page.locator('.history-row').filter({ has: page.locator('strong').getByText('Bb5', { exact: true }) }).click();
  await expect(page.getByLabel('Recorded analysis', { exact: true })).toHaveCount(0);
  const selected = await saveCurrentGame(page, 'Reviewed recorded move');
  const record = nodeAt(selected, selected.renderedPath).recordedAnalysis!;
  expect(record.seats.map((seat) => seat.assignedEngine.displayName)).toEqual(['Journey A', 'Journey B']);
  for (const seat of record.seats) expect(seat.lines).toHaveLength(3);
}
