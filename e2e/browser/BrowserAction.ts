import { expect, type Page, type FileChooser } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { IGame, IGameSessionSnapshot } from '../../src/contracts';
import { playMove } from '../support/BoardInteraction';
import { browserDocument } from './BrowserStorage';

export async function createGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Quick game/ }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  await expect(page.locator('html')).toHaveAttribute('data-app-mode', 'false');
  expect(await page.evaluate(() => window.chessVueJourney)).toBeUndefined();
}
export async function playOpening(page: Page) {
  await playMove(page, 'e2', 'e4');
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
}
export async function downloadGame(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  expect(await download.failure()).toBeNull();
  const path = (await download.path())!;
  return { path, game: JSON.parse(await readFile(path, 'utf8')) as IGame };
}
export async function exportGame(page: Page) {
  await openSave(page);
  return (await downloadGame(page)).game;
}
export async function openSave(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/saved-games\/save\/.+/);
  await expect.poll(async () => (await browserDocument<IGameSessionSnapshot>(page, 'game-session.json'))?.activeRoute).toBe(new URL(page.url()).pathname);
}
export async function uploadGame(page: Page, file: Parameters<FileChooser['setFiles']>[0]) {
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await (await pending).setFiles(file);
}
export async function saveNamedGame(page: Page, name: string) {
  await openSave(page);
  await page.getByLabel('Save name').fill(name);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.locator('.save-row__content')).toContainText([name]);
}
export function expectCanonical(actual: IGame, expected: IGame, freshIdentity = false) {
  if (freshIdentity) expect(actual.metadata.id).not.toBe(expected.metadata.id);
  else expect(actual.metadata.id).toBe(expected.metadata.id);
  expect({ ...actual, metadata: { ...actual.metadata, id: expected.metadata.id, updatedAt: expected.metadata.updatedAt } }).toEqual(expected);
  expect(JSON.stringify(actual)).not.toContain('"$"');
}
