import { expect, type Page } from '@playwright/test';
import type { IGame, IGameSessionSnapshot } from '../../src/contracts';

export async function readFile(page: Page, path: string): Promise<string | undefined> {
  return page.evaluate((filePath) => window.chessVueJourney.readFile(filePath), path);
}
export async function readGame(page: Page, path: string): Promise<IGame> {
  await expect.poll(() => readFile(page, path)).toBeTruthy();
  return JSON.parse((await readFile(page, path))!) as IGame;
}
export async function readSession(page: Page): Promise<IGameSessionSnapshot> {
  await expect.poll(() => readFile(page, 'game-session.json')).toBeTruthy();
  return JSON.parse((await readFile(page, 'game-session.json'))!) as IGameSessionSnapshot;
}
export async function managedFiles(page: Page): Promise<string[]> {
  return page.evaluate(() => window.chessVueJourney.listFiles().filter((path) => path.startsWith('saves/')));
}
