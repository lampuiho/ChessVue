import { expect, type Page } from '@playwright/test';
import { openJourney, waitForJourney } from '../support/JourneyBootstrap';
import { openCustomGame, setCustomClock, createWorkspace } from '../support/GameCreation';
import { playMove } from '../support/BoardInteraction';
import { readGame } from '../support/SaveInspection';
import { snapshotRow } from '../support/SnapshotBrowser';
import { expectOutput } from '../journeys/analysis/AnalysisAction';
export async function openSession(page: Page) {
  await openJourney(page, 'sessions');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.recent-card')).toHaveCount(0);
}
export async function createSessionGame(page: Page, name: string, minutes?: string, engines: string[] = [], black = 'local') {
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill(name);
  if (minutes) await setCustomClock(dialog, minutes, '0');
  else await dialog.getByLabel('Clock', { exact: true }).selectOption('untimed');
  await dialog.getByLabel('Black', { exact: true }).selectOption(black === 'local' ? 'local' : { label: black });
  for (const engine of engines) await dialog.getByRole('checkbox', { name: engine, exact: true }).check();
  if (engines.length) await dialog.getByText('Show live analysis moves', { exact: true }).click();
  const id = await createWorkspace(page);
  if (engines.length) await expectOutput(page, engines);
  return id;
}
export async function playSessionMoves(page: Page, moves: readonly (readonly [string, string])[], engines: string[] = []) {
  for (const [from, to] of moves) {
    await playMove(page, from, to);
    if (engines.length) await expectOutput(page, engines);
  }
}
export async function openSessionSnapshots(page: Page, id: string, name?: string) {
  await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
  if (name) await page.locator('.game-row').filter({ has: page.locator('strong').getByText(name, { exact: true }) }).click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/saved-games/load/' + id + '$'));
}
export async function loadSessionSnapshot(page: Page, name: string) {
  await snapshotRow(page, name).locator('.save-row__content').click();
  await expect(page.getByLabel('Selected save details').getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load selected', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  return page.url().split('/').pop()!;
}
export async function reloadSession(page: Page) {
  await page.reload();
  await waitForJourney(page);
}
export async function exportSession(page: Page, path: string) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.evaluate((path) => window.chessVueJourney.chooseExport(path), path);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.library-feedback')).toHaveText('Game exported.');
  return readGame(page, path);
}
export async function importSession(page: Page, path: string) {
  await page.evaluate((path) => window.chessVueJourney.chooseImport(path), path);
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  return page.url().split('/').pop()!;
}
