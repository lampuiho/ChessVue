import { test, expect } from './SessionTest';
import type { Page } from '@playwright/test';
import type { IGame } from '../../src/contracts';
import { libraryContinuation, libraryExportPath, libraryOpening, otherOpening } from '../../journeys/definitions/sessions/data/SessionScenario';
import { playMove, square } from '../support/BoardInteraction';
import { saveCurrentGame } from '../support/GameSave';
import { readFile, readGame, readSession } from '../support/SaveInspection';
import { deleteSnapshot, expectCanonical } from '../journeys/saves/SaveAction';
import { advanceClock } from '../journeys/clocks/ClockAction';
import { expectOperation, failNext, managedSnapshot } from '../journeys/storage-failures/StorageAction';
import { createSessionGame, exportSession, importSession, loadSessionSnapshot, openSession, openSessionSnapshots, playSessionMoves, reloadSession } from './SessionAction';
async function createLibrary(page: Page) {
  const firstId = await createSessionGame(page, 'First library session');
  await playSessionMoves(page, libraryOpening);
  const opening = await saveCurrentGame(page, 'Opening');
  await playSessionMoves(page, libraryContinuation);
  await advanceClock(page, 1000);
  const latest = await saveCurrentGame(page, 'Latest');
  const otherId = await createSessionGame(page, 'Other library session');
  await playSessionMoves(page, otherOpening);
  const other = await saveCurrentGame(page, 'Other');
  expect(new Set([firstId, otherId]).size).toBe(2);
  expect((await readSession(page)).openGameIds).toEqual([firstId, otherId]);
  return { firstId, otherId, opening, latest, other };
}
async function selectOriginalGame(page: Page, id: string) {
  // The original game keeps the first tab even when loaded copies share its name.
  await page.locator('.tab-button').first().click();
  await expect(page).toHaveURL(new RegExp('/game/' + id + '$'));
}
async function compareLoads(page: Page, library: Awaited<ReturnType<typeof createLibrary>>) {
  const before = await managedSnapshot(page);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.locator('.game-row').filter({ hasText: 'First library session' }).dblclick();
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  const latestId = page.url().split('/').pop()!;
  expect(latestId).not.toBe(library.firstId);
  expect(await managedSnapshot(page)).toEqual(before);
  expectCanonical(await saveCurrentGame(page, 'Loaded latest'), library.latest);
  await expect(page.locator('.history-row')).toHaveCount(4);
  await selectOriginalGame(page, library.firstId);
  await openSessionSnapshots(page, library.firstId);
  const selectedId = await loadSessionSnapshot(page, 'Opening');
  expect(new Set([library.firstId, library.otherId, latestId, selectedId]).size).toBe(4);
  expectCanonical(await saveCurrentGame(page, 'Loaded selected'), library.opening);
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1 white knight');
}
async function importDuplicateCopies(page: Page) {
  const exported = await exportSession(page, libraryExportPath);
  const originalFiles = await managedSnapshot(page);
  const firstId = await importSession(page, libraryExportPath);
  const first = await saveCurrentGame(page, 'Duplicate one');
  expectCanonical(first, exported);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const secondId = await importSession(page, libraryExportPath);
  await advanceClock(page, 1000);
  const second = await saveCurrentGame(page, 'Duplicate two');
  expectCanonical(second, exported);
  expect(new Set([exported.metadata.id, firstId, secondId]).size).toBe(3);
  const after = await managedSnapshot(page);
  for (const [path, raw] of Object.entries(originalFiles)) expect(after[path]).toBe(raw);
  expect(after[`saves/${firstId}/Duplicate one.json`]).toBeTruthy();
  expect(after[`saves/${secondId}/Duplicate two.json`]).toBeTruthy();
  expect((await readSession(page)).openGameIds).toHaveLength(6);
  return second;
}
async function deleteChosenSnapshot(page: Page, id: string) {
  await selectOriginalGame(page, id);
  await openSessionSnapshots(page, id);
  const before = await managedSnapshot(page);
  await deleteSnapshot(page, 'Opening');
  const expected = { ...before };
  delete expected[`saves/${id}/Opening.json`];
  expect(await managedSnapshot(page)).toEqual(expected);
  await expect(page).toHaveURL(new RegExp('/saved-games/load/' + id + '$'));
  await expect(page.getByRole('button', { name: 'Load selected', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/game/' + id + '$'));
}
async function retryNamedSave(page: Page, game: IGame) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const before = await managedSnapshot(page);
  const path = `saves/${game.metadata.id}/Retry snapshot.json`;
  await failNext(page, 'writeTextFile', path);
  await page.getByLabel('Save name').fill('Retry snapshot');
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expectOperation(page, 'writeTextFile', path, 'failed');
  await expect(page.locator('.library-actions .library-feedback--error')).toContainText('Try again');
  expect(await readFile(page, path)).toBeUndefined();
  expect(await managedSnapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expectOperation(page, 'writeTextFile', path, 'succeeded');
  await expect(page.getByLabel('Selected save details')).toContainText('2 plies');
  expectCanonical(await readGame(page, path), game);
  const after = await managedSnapshot(page);
  delete after[path];
  expect(after).toEqual(before);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  return path;
}
async function reopenAndRetry(page: Page, recent: IGame) {
  const session = await readSession(page);
  await page.getByRole('button', { name: 'ChessVue home', exact: true }).click();
  await page.locator('.recent-card').first().click();
  await expect(page).toHaveURL(new RegExp('/game/' + recent.metadata.id + '$'));
  expect((await readSession(page)).openGameIds).toEqual(session.openGameIds);
  await expect(page.locator('.history-row')).toHaveCount(2);
  const path = await retryNamedSave(page, recent);
  await advanceClock(page, 1000);
  await playMove(page, 'c2', 'c4');
  await reloadSession(page);
  await expect(page).toHaveURL(new RegExp('/game/' + recent.metadata.id + '$'));
  await expect(page.locator('.history-row')).toHaveCount(3);
  expect((await readSession(page)).openGameIds).toEqual(session.openGameIds);
  expectCanonical(await readGame(page, path), recent);
}
test('JRN-SESSION-04 keeps library identities and files independent through load, import, deletion and retry', async ({ page }) => {
  await openSession(page);
  const library = await test.step('Create two independent games with earlier and latest named saves', () => createLibrary(page));
  await test.step('Compare latest load with an explicitly selected earlier snapshot', () => compareLoads(page, library));
  const recent = await test.step('Import the same exported payload twice with independent identities', () => importDuplicateCopies(page));
  await test.step('Delete only the chosen original snapshot', () => deleteChosenSnapshot(page, library.firstId));
  await test.step('Reopen the latest recent copy, recover a failed write and reload playable work', () => reopenAndRetry(page, recent));
});
