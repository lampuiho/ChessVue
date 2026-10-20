import { test, expect } from './SessionTest';
import type { Page } from '@playwright/test';
import type { IGame } from '../../src/contracts';
import { firstPlayerOpening } from '../../journeys/definitions/sessions/data/SessionScenario';
import { playMove, square } from '../support/BoardInteraction';
import { saveCurrentGame } from '../support/GameSave';
import { readFile, readSession } from '../support/SaveInspection';
import { expectCanonical, nodeAt } from '../journeys/saves/SaveAction';
import { expectOutput } from '../journeys/analysis/AnalysisAction';
import { advanceClock, playerClock, resumeClock } from '../journeys/clocks/ClockAction';
import { historyRow } from '../journeys/setup/SetupAction';
import { createSessionGame, loadSessionSnapshot, openSession, openSessionSnapshots, playSessionMoves, reloadSession } from './SessionAction';
async function playRecordedOpening(page: Page) {
  await createSessionGame(page, 'First player session', '5', ['Journey A', 'Journey B']);
  await advanceClock(page, 1000);
  await playSessionMoves(page, firstPlayerOpening, ['Journey A', 'Journey B']);
  await expect(square(page, 'd5')).toHaveAttribute('aria-label', 'd5 white pawn');
  await expect(square(page, 'e4').locator('.chess-piece')).toHaveCount(0);
  const saved = await saveCurrentGame(page, 'Opening capture');
  for (let length = 1; length <= 3; length++) {
    const record = nodeAt(saved, saved.livePath!.slice(0, length)).recordedAnalysis;
    expect(record?.seats.map((seat) => seat.assignedEngine.displayName)).toEqual(['Journey A', 'Journey B']);
    for (const seat of record!.seats) expect(seat.lines).toHaveLength(3);
  }
  expect(saved.clockSnapshot.white.remainingMs).toBe(299000);
  return saved;
}
async function exploreAndContinue(page: Page, opening: IGame) {
  await page.getByRole('button', { name: /^Analyse Explore/ }).click();
  await playSessionMoves(page, [['g8', 'f6'], ['g1', 'f3']], ['Journey A', 'Journey B']);
  await advanceClock(page, 30000);
  const explored = await saveCurrentGame(page, 'Temporary exploration');
  expect(explored.livePath).toEqual(opening.livePath);
  expect(explored.clockSnapshot).toEqual(opening.clockSnapshot);
  for (const length of [4, 5]) expect(nodeAt(explored, explored.renderedPath.slice(0, length)).recordedAnalysis).toBeUndefined();
  await page.getByRole('button', { name: /^Exit analysis/ }).click();
  await expectOutput(page);
  await expect(square(page, 'g8')).toHaveAttribute('aria-label', 'g8 black knight');
  await advanceClock(page, 2000);
  await playMove(page, 'c7', 'c6');
  await expectOutput(page);
  const saved = await saveCurrentGame(page, 'Continue later');
  expect(saved.livePath).toEqual([0, 0, 0, 0]);
  expect(nodeAt(saved, opening.livePath!).children).toHaveLength(1);
  expect(nodeAt(saved, saved.livePath!).kind).toBe('live');
  for (let length = 1; length <= 3; length++) {
    const path = opening.livePath!.slice(0, length);
    expect(nodeAt(saved, path).recordedAnalysis).toEqual(nodeAt(opening, path).recordedAnalysis);
  }
  expect(saved.clockSnapshot.black.remainingMs).toBe(298000);
  return saved;
}
async function restoreSelectedGame(page: Page, saved: IGame) {
  const path = `saves/${saved.metadata.id}/Continue later.json`;
  const bytes = await readFile(page, path);
  await reloadSession(page);
  await openSessionSnapshots(page, saved.metadata.id);
  const id = await loadSessionSnapshot(page, 'Continue later');
  expect(id).not.toBe(saved.metadata.id);
  expect((await readSession(page)).openGameIds).toEqual([saved.metadata.id, id]);
  await expectOutput(page);
  expectCanonical(await saveCurrentGame(page, 'Selected restored'), saved);
  await resumeClock(page);
  await historyRow(page, 'exd5').click();
  const recorded = page.getByLabel('Recorded analysis', { exact: true });
  await expect(recorded).toContainText('Before this move');
  for (const name of ['Journey A', 'Journey B']) await expect(recorded).toContainText(name);
  await page.getByRole('button', { name: 'Live position', exact: true }).click();
  await expect(square(page, 'c6')).toHaveAttribute('aria-label', 'c6 black pawn');
  await advanceClock(page, 1000);
  await expect(playerClock(page, 'white')).toHaveText('4:58');
  expect(await readFile(page, path)).toBe(bytes);
  return id;
}
async function resignAndReopen(page: Page, id: string) {
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('dialog', { name: 'Resign this game?', exact: true }).getByRole('button', { name: 'Resign', exact: true }).click();
  await expect(page.locator('.result-badge')).toHaveText('black won');
  const finished = await saveCurrentGame(page, 'Resigned result');
  expect(finished.resultReason).toBe('resignation');
  expect(finished.clockSnapshot.white.isRunning || finished.clockSnapshot.black.isRunning).toBe(false);
  await reloadSession(page);
  await openSessionSnapshots(page, id);
  await loadSessionSnapshot(page, 'Resigned result');
  await expectOutput(page);
  await expect(page.locator('.result-badge')).toHaveText('black won');
  await expect(page.getByRole('button', { name: /^Resume game|^Resign$/ })).toHaveCount(0);
  expectCanonical(await saveCurrentGame(page, 'Reopened result'), finished);
}
test('JRN-SESSION-01 plays, records, explores, resumes a selected save and reopens resignation', async ({ page }) => {
  await openSession(page);
  const opening = await test.step('Create a timed game and record opening moves and capture', () => playRecordedOpening(page));
  const saved = await test.step('Explore both sides, return and continue actual play', () => exploreAndContinue(page, opening));
  const id = await test.step('Reload, explicitly load the named snapshot, review its record and resume', () => restoreSelectedGame(page, saved));
  await test.step('Resign and reopen the persisted result', () => resignAndReopen(page, id));
});
