import { test, expect } from './SessionTest';
import type { Page } from '@playwright/test';
import type { IGame } from '../../src/contracts';
import { playMove, square } from '../support/BoardInteraction';
import { saveCurrentGame } from '../support/GameSave';
import { readFile, readGame } from '../support/SaveInspection';
import { expectCanonical, nodeAt } from '../journeys/saves/SaveAction';
import { expectOutput } from '../journeys/analysis/AnalysisAction';
import { advanceClock, dismissTimeout, expectTimeout, playerClock } from '../journeys/clocks/ClockAction';
import { latestSearch, playerSearchCount, release } from '../journeys/engine-races/RaceAction';
import { historyRow } from '../journeys/setup/SetupAction';
import { applySettings } from '../journeys/settings/SettingsAction';
import { createSessionGame, openSession, reloadSession } from './SessionAction';
async function _interruptEngineTurn(page: Page) {
  await page.evaluate(() => window.chessVueJourney.engines.hold('player'));
  const id = await createSessionGame(page, 'Interrupted session', '1', ['Journey A'], 'Journey B');
  await advanceClock(page, 1000);
  await playMove(page, 'e2', 'e4');
  await expectOutput(page, ['Journey A']);
  const search = await latestSearch(page, 'player', 'journey://b');
  const path = `saves/${id}/auto.json`;
  await expect.poll(async () => (await readGame(page, path)).livePath).toEqual([0]);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/session$/);
  const bytes = await readFile(page, path);
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('radio', { name: 'dark', exact: true }).check();
  await page.getByLabel('Orientation', { exact: true }).selectOption('black');
  await applySettings(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await release(page, search.id);
  await expect.poll(() => page.evaluate((id) => window.chessVueJourney.engines.searches().find((search) => search.id === id)?.pending, search.id)).toBe(false);
  await advanceClock(page, 120000);
  expect(await readFile(page, path)).toBe(bytes);
  expect(await playerSearchCount(page)).toBe(1);
  return id;
}
async function _returnThenTimeout(page: Page) {
  await page.getByRole('button', { name: 'Back to game', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(playerClock(page, 'black')).toHaveText('1:00');
  await expect(playerClock(page, 'white')).toHaveText('0:59');
  await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', /^h1/);
  await expectOutput(page, ['Journey A']);
  const replied = await saveCurrentGame(page, 'Returned reply');
  expect(replied.livePath).toEqual([0, 0]);
  expect(nodeAt(replied, [0]).recordedAnalysis?.seats).toHaveLength(1);
  expect(nodeAt(replied, [0, 0]).recordedAnalysis?.seats).toHaveLength(1);
  expect(await playerSearchCount(page)).toBe(1);
  await advanceClock(page, 59000);
  await expectTimeout(page, 'Black');
  await dismissTimeout(page);
  const ended = await saveCurrentGame(page, 'Timeout result');
  expect(ended.resultState).toBe('blackWon');
  expect(ended.resultReason).toBe('timeout');
  expect(ended.livePath).toEqual(replied.livePath);
  return ended;
}
async function _reviewTimeout(page: Page, ended: IGame) {
  await historyRow(page, 'e4').click();
  await expect(page.getByLabel('Recorded analysis', { exact: true })).toHaveCount(0);
  await expectOutput(page, ['Journey A']);
  await page.getByRole('button', { name: 'Live position', exact: true }).click();
  await playMove(page, 'g1', 'f3');
  await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
  await expectOutput(page, ['Journey A']);
  const reviewed = await saveCurrentGame(page, 'Timeout review');
  expect(reviewed.resultState).toBe(ended.resultState);
  expect(reviewed.resultReason).toBe(ended.resultReason);
  expect(reviewed.clockSnapshot).toEqual(ended.clockSnapshot);
  expect(reviewed.livePath).toEqual(ended.livePath);
  expect(nodeAt(reviewed, reviewed.renderedPath).recordedAnalysis).toBeUndefined();
  for (const path of [[0], [0, 0]]) expect(nodeAt(reviewed, path).recordedAnalysis).toEqual(nodeAt(ended, path).recordedAnalysis);
  return reviewed;
}
async function _restoreTimeoutReview(page: Page, id: string, reviewed: IGame) {
  await reloadSession(page);
  await expect(page).toHaveURL(new RegExp('/game/' + id + '$'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.result-badge')).toHaveText('black won');
  await expect(page.getByRole('button', { name: /^Resume game|^Resign$/ })).toHaveCount(0);
  await page.clock.runFor(250);
  await expectTimeout(page, 'Black');
  await dismissTimeout(page);
  await expectOutput(page, ['Journey A']);
  expectCanonical(await saveCurrentGame(page, 'Restored timeout review'), reviewed);
  await advanceClock(page, 120000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await playerSearchCount(page)).toBe(0);
}
test('JRN-SESSION-03 defers an interrupted reply through appearance changes and preserves timeout review', async ({ page }) => {
  await openSession(page);
  const id = await test.step('Hold an engine turn and finish its reply while Settings owns the pause', () => _interruptEngineTurn(page));
  const ended = await test.step('Return for one reply, then expire the human clock', () => _returnThenTimeout(page));
  const reviewed = await test.step('Review actual-move records without reversing the result', () => _reviewTimeout(page, ended));
  await test.step('Reload, dismiss the reopened result notice and retain the reviewed workspace', () => _restoreTimeoutReview(page, id, reviewed));
});
