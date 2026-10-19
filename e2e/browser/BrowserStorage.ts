import type { Page } from '@playwright/test';
import type { IGame } from '../../src/contracts';

export async function browserStorageSnapshot(page: Page) {
  return page.evaluate(() => localStorage.getItem('chessvue:files:v1'));
}
export async function browserFiles(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem('chessvue:files:v1') ?? '{"files":{}}') as { files: Record<string, { raw: string }> };
    return Object.fromEntries(Object.entries(snapshot.files).map(([path, file]) => [path, file.raw]));
  });
}
export async function browserDocument<T>(page: Page, path: string): Promise<T | undefined> {
  const raw = (await browserFiles(page))[path];
  return raw === undefined ? undefined : JSON.parse(raw) as T;
}
export function autosavePath(gameId: string) {
  return `saves/${gameId}/auto.json`;
}
export async function browserGame(page: Page, gameId: string) {
  return browserDocument<IGame>(page, autosavePath(gameId));
}
export function gameId(page: Page) {
  return new URL(page.url()).pathname.split('/').at(-1)!;
}
