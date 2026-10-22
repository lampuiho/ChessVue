import { expect, type Page } from '@playwright/test';
import type { IGame, IMove, MovePath } from '../../../src/contracts';
import { playMove, square } from '../../support/BoardInteraction';
import { selectGame } from '../../support/GameNavigation';
import { openCustomGame, setCustomClock, createWorkspace } from '../../support/GameCreation';
export function analysisSeat(page: Page, name = 'Journey A') {
  return page.locator('.analysis-panel .engine-section').filter({ has: page.getByText(name, { exact: true }) });
}
export async function expectOutput(page: Page, names = ['Journey A', 'Journey B']) {
  for (const name of names) {
    const seat = analysisSeat(page, name);
    await expect(seat.locator('.engine-section__status--running')).toHaveCount(1);
    await expect(seat.locator('.analysis-line')).toHaveCount(3);
    await expect(seat.locator('.analysis-line').first().getByRole('button')).toHaveCount(4);
    await expect(seat.locator('.engine-section__score')).toHaveText(name === 'Journey B' ? '+0.36' : '+0.24');
    await expect(seat.locator('.analysis-line__score')).toHaveText(name === 'Journey B' ? ['+0.36', '+0.18', '+0.00'] : ['+0.24', '+0.06', '−0.12']);
  }
}
export async function selectAnalysisGame(page: Page, moves = true) {
  await selectGame(page, moves ? 'analysis-live-moves' : 'analysis-score-only', moves ? 'Live analysis moves enabled' : 'Live score-only analysis');
}
export async function addEngine(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add engine', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add analysis engine', exact: true });
  await dialog.getByRole('radio', { name: new RegExp(name + ' ') }).check();
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
export async function createTimedAnalysis(page: Page) {
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill('Timed analysis');
  await setCustomClock(dialog);
  await dialog.getByText('Show live analysis moves', { exact: true }).click();
  await createWorkspace(page);
  await playMove(page, 'e2', 'e4');
  await playMove(page, 'e7', 'e5');
  await addEngine(page, 'Journey A');
  await addEngine(page, 'Journey B');
}
export async function setResumeAfterRestore(page: Page, resume: boolean) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Engines', exact: true }).click();
  const row = page.locator('.field-row').filter({ hasText: 'Resume after restore' });
  if (!resume) await row.locator('label').click();
  await expect(row.getByRole('checkbox')).toBeChecked({ checked: resume });
  await page.getByRole('button', { name: resume ? 'Back to game' : 'Save', exact: true }).click();
}
export function nodeAt(game: IGame, path: MovePath) {
  return path.reduce((node, index) => node.children[index]!, game.moveTree.root);
}
export function squareName(id: number): string {
  return String.fromCharCode(97 + id % 8) + (Math.floor(id / 8) + 1);
}
export async function expectMoveBoard(page: Page, move: IMove, actualColour = move.movingColour === 'white' ? 'black' : 'white') {
  await expect(square(page, squareName(move.to))).toHaveAttribute('aria-label', `${squareName(move.to)} ${move.movingColour} ${move.promotionPiece ?? move.movingPiece}`);
  await expect(page.locator('.result-badge')).toHaveText(`${actualColour} to move`);
}
export function expectPrefix(game: IGame, anchor: MovePath, prefix: readonly IMove[], kind: string) {
  expect(game.renderedPath).toHaveLength(anchor.length + prefix.length);
  prefix.forEach((move, index) => {
    const node = nodeAt(game, game.renderedPath.slice(0, anchor.length + index + 1));
    expect(node).toMatchObject({ kind, move });
    if (kind === 'analysis') expect(node.recordedAnalysis).toBeUndefined();
  });
  expect(nodeAt(game, game.renderedPath).children).toHaveLength(0);
  expect(JSON.stringify(game)).not.toContain('"$"');
}
