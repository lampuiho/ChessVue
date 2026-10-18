import { expect, type Page } from '@playwright/test';
import type { IGame, MovePath } from '../../../src/contracts';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { readFile } from '../../support/SaveInspection';
export function snapshotRow(page: Page, name: string) {
  return page.locator('.save-row').filter({ has: page.locator('.save-row__content strong').getByText(name, { exact: true }) });
}
export async function openLibraryGame(page: Page): Promise<void> {
  await openJourney(page, 'saves');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/save-library$/);
}
export async function setAutosaveInterval(page: Page, interval: number): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Autosave interval', { exact: false }).fill(String(interval));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/save-library$/);
}
export async function fileSnapshot(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => Object.fromEntries(window.chessVueJourney.listFiles()
    .filter((path) => path !== 'game-session.json' && path !== 'layout-state.json')
    .map((path) => [path, window.chessVueJourney.readFile(path)])));
}
export function expectCanonical(actual: IGame, expected: IGame): void {
  expect({ ...actual, metadata: { ...actual.metadata, id: expected.metadata.id, updatedAt: expected.metadata.updatedAt } }).toEqual(expected);
  expect(JSON.stringify(actual)).not.toContain('"$"');
}
export function nodeAt(game: IGame, path: MovePath) {
  return path.reduce((node, index) => node.children[index]!, game.moveTree.root);
}
export async function reloadSaved(page: Page, path: string): Promise<void> {
  const bytes = await readFile(page, path);
  await page.reload();
  await waitForJourney(page);
  expect(await readFile(page, path)).toBe(bytes);
}
export async function deleteSnapshot(page: Page, name: string): Promise<void> {
  await snapshotRow(page, name).getByRole('button', { name: 'Delete save', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete this save?', exact: true }).getByRole('button', { name: 'Delete save', exact: true }).click();
  await expect(snapshotRow(page, name)).toHaveCount(0);
}
