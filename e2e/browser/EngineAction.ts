import { expect, type Page } from '@playwright/test';
import { gameSchema, type IGame, type IMove } from '../../src/contracts';
import { StockfishConfig } from '../../src/config/StockfishConfig';
import { applyMove, isMoveLegal } from '../../src/utility/chess/GameRuleUtility';

export interface IBrowserEngineProfile { name: string; path: string; }
export async function configureEngines(page: Page, profiles: IBrowserEngineProfile[]) {
  await page.goto('/');
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Engines', exact: true }).click();
  while (await page.getByRole('button', { name: 'Delete', exact: true }).count()) await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  for (const profile of profiles) {
    await page.getByRole('button', { name: 'Add profile', exact: true }).click();
    await page.getByLabel('Profile name').fill(profile.name);
    await page.locator('#engine-path').fill(profile.path);
    await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Custom game/ }).click();
}
export async function configureStockfish(page: Page, engineCount = 1) {
  await configureEngines(page, Array.from({ length: engineCount }, (_, index) => ({ name: index ? `Browser Stockfish ${index + 1}` : 'Browser Stockfish', path: StockfishConfig.entryPath })));
}
export async function createAnalysis(page: Page, names: string[]) {
  await page.getByRole('button', { name: 'Free analysis', exact: true }).click();
  for (const name of names) await page.getByRole('checkbox', { name, exact: true }).check();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
}
export function engineSection(page: Page, name: string) {
  return page.locator('.engine-section').filter({ has: page.getByRole('button', { name, exact: true }) });
}
export async function expectAnalysis(page: Page, names: string[]) {
  for (const name of names) {
    const section = engineSection(page, name);
    await expect(section.locator('.engine-section__status--running')).toBeVisible();
    await expect(section.locator('.analysis-line')).toHaveCount(3, { timeout: 20000 });
    await expect(section.locator('.analysis-line__moves button').first()).toBeVisible();
  }
}
export function replayLegalMoves(game: IGame, moves: readonly IMove[]) {
  let position = gameSchema.parse(game).rootPosition;
  for (const move of moves) {
    expect(isMoveLegal(position, move), `Legal move ${move.from}-${move.to}`).toBe(true);
    position = applyMove(position, move);
  }
  return position;
}
export function expectCurrentAnalysis(game: IGame) {
  const moves: IMove[] = [];
  let node = game.moveTree.root;
  for (const index of game.renderedPath) {
    node = node.children[index]!;
    moves.push(node.move!);
  }
  for (const seat of game.analysis.seats) {
    expect(seat.lines).toHaveLength(3);
    for (const line of seat.lines) {
      expect(line.pv.length).toBeGreaterThan(0);
      replayLegalMoves(game, [...moves, ...line.pv]);
    }
  }
}
