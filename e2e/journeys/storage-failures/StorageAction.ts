import { expect, type Page } from '@playwright/test';
import type { StorageOperation } from '../../../journeys/runtime/storage/JourneyStorageBarrier';
import { openJourney } from '../../support/JourneyBootstrap';
export const gamePath = 'saves/io-game/';
export async function openStorageGame(page: Page) {
  await openJourney(page, 'storage-failures');
  await expect(page).toHaveURL(/\/game\/io-game$/);
  await expect(page.locator('.history-row')).toHaveCount(4);
}
export async function failNext(page: Page, operation: StorageOperation, path: string) {
  await page.evaluate(({ operation, path }) => window.chessVueJourney.storage.failNext(operation, path), { operation, path });
}
export async function expectOperation(page: Page, operation: StorageOperation, path: string, state: string) {
  await expect.poll(() => page.evaluate(({ operation, path }) => window.chessVueJourney.storage.operations()
    .filter((call) => call.operation === operation && call.path === path).at(-1)?.state, { operation, path })).toBe(state);
}
export async function managedSnapshot(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => Object.fromEntries(window.chessVueJourney.listFiles().filter((path) => path.startsWith('saves/'))
    .map((path) => [path, window.chessVueJourney.readFile(path)])));
}
export async function openSnapshots(page: Page) {
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.locator('.game-row').filter({ hasText: 'Storage game' }).first().click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  await expect(page.getByLabel('Selected save details')).toContainText('4 plies');
}
export async function holdRead(page: Page, path: string): Promise<number> {
  return page.evaluate((path) => window.chessVueJourney.storage.holdNext('readTextFile', path), path);
}
export async function releaseRead(page: Page, id: number) {
  await page.evaluate((id) => window.chessVueJourney.storage.release(id), id);
  await expect.poll(() => page.evaluate((id) => window.chessVueJourney.storage.operations().find((call) => call.id === id)?.state, id)).toBe('succeeded');
}
