import { expect, type Locator, type Page } from '@playwright/test';
import type { IGame } from '../../../src/contracts';
import { selectGame } from '../../support/GameNavigation';
export function historyRow(page: Page, move: string): Locator {
  return page.locator('.history-row').filter({ has: page.locator('strong', { hasText: new RegExp('^' + move + '$') }) });
}
export async function selectSetupBoard(page: Page): Promise<void> {
  await selectGame(page, 'setup-board', 'Editable endgame setup');
}
export async function finishEditing(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Finish editing/ }).click();
  await expect(page.locator('.piece-palette')).toHaveCount(0);
}
export async function openSetupStart(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /Start game/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Start from this position', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function addAnalysisEngine(page: Page, name = 'Journey A'): Promise<void> {
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await dialog.getByRole('radio', { name: new RegExp(name) }).check();
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
export function expectFreeWorkspace(game: IGame): void {
  expect(game.livePath).toBeUndefined();
  expect(game.whitePlayer).toBeUndefined();
  expect(game.blackPlayer).toBeUndefined();
  expect(game.clockSnapshot.white.isRunning).toBe(false);
  expect(game.clockSnapshot.black.isRunning).toBe(false);
  expect(game.resultState).toBe('ongoing');
  expect(JSON.stringify(game)).not.toContain('"$"');
}
