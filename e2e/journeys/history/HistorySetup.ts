import { expect, type Page } from '@playwright/test';
import type { IGame, IMoveNode, MovePath } from '../../../src/contracts';
import { playMove } from '../../support/BoardInteraction';
import { openCustomGame, setCustomClock, createWorkspace } from '../../support/GameCreation';
export function historyRow(page: Page, san: string) {
  return page.locator('.history-row').filter({ has: page.locator('strong').getByText(san, { exact: true }) });
}
export function nodeAt(game: IGame, path: MovePath): IMoveNode {
  return path.reduce((node, index) => node.children[index]!, game.moveTree.root);
}
export async function createTimedHistory(page: Page, timed = true): Promise<string> {
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill('Timed history');
  if (timed) await setCustomClock(dialog);
  await dialog.getByText('Show live analysis moves', { exact: true }).click();
  const id = await createWorkspace(page);
  await playMove(page, 'e2', 'e4');
  await playMove(page, 'e7', 'e5');
  return id;
}
export async function addAnalysisEngine(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await dialog.getByRole('radio', { name: /Journey A/ }).check();
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await expect(page.locator('.analysis-line')).toHaveCount(3);
}
export async function returnLive(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live position', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Live position', exact: true })).toHaveCount(0);
}
