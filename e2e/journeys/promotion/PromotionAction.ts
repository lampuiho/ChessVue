import { expect, type Locator, type Page } from '@playwright/test';
import { CheckState, GameState, MoveKind, PieceKind, ResultReason, ResultState, type IGame } from '../../../src/contracts';
import { promotionPieces, type IPromotionScenario } from '../../../journeys/definitions/promotion/data/PromotionScenario';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { selectGame } from '../../support/GameNavigation';
export function promotionChooser(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Choose promotion', exact: true });
}
export async function openPromotionGame(page: Page, scenario: IPromotionScenario) {
  await openJourney(page, 'promotion');
  if (scenario.colour === 'black') await selectGame(page, 'promotion-black', 'black to promote');
  await expect(page).toHaveURL(new RegExp('/game/promotion-' + scenario.colour + '$'));
  await expect(page.locator('.result-badge')).toHaveText(`${scenario.colour} to move`);
}
export async function attemptPromotion(page: Page, scenario: IPromotionScenario, capture: boolean, gesture = 'click') {
  const target = capture ? scenario.capture : scenario.quiet;
  if (gesture === 'drag') await square(page, scenario.from).locator('.chess-piece').dragTo(square(page, target));
  else await playMove(page, scenario.from, target);
  await expect(promotionChooser(page)).toBeVisible();
  await expect(promotionChooser(page).getByRole('button', { name: /^Promote to / })).toHaveCount(4);
  await expect(promotionChooser(page).getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(promotionChooser(page).getByRole('button', { name: 'Close dialog', exact: true })).toBeVisible();
  for (const { kind } of promotionPieces) await expect(promotionChooser(page).getByRole('button', { name: `Promote to ${scenario.colour} ${kind}`, exact: true })).toBeVisible();
  await expect(square(page, scenario.from)).toHaveAttribute('aria-label', `${scenario.from} ${scenario.colour} pawn`);
  await expect(square(page, scenario.capture)).toHaveAttribute('aria-label', `${scenario.capture} ${scenario.opponent} rook`);
  await expect(page.locator('.history-row')).toHaveCount(0);
  await expect(page.locator('.result-badge')).toHaveText(`${scenario.colour} to move`);
  await expect(page.getByLabel('Captured material')).toHaveCount(0);
}
export async function choosePromotion(page: Page, scenario: IPromotionScenario, kind: PieceKind) {
  await promotionChooser(page).getByRole('button', { name: `Promote to ${scenario.colour} ${kind}`, exact: true }).click();
  await expect(promotionChooser(page)).toHaveCount(0);
}
export function promotionSan(scenario: IPromotionScenario, kind: PieceKind, capture: boolean): string {
  const target = capture ? scenario.capture : scenario.quiet;
  const letter = promotionPieces.find((piece) => piece.kind === kind)!.letter;
  const check = capture && (kind === PieceKind.Queen || kind === PieceKind.Rook);
  return `${capture ? scenario.from[0] + 'x' : ''}${target}=${letter}${check ? '+' : ''}`;
}
export async function expectPromotedBoard(page: Page, scenario: IPromotionScenario, kind: PieceKind, capture: boolean) {
  const target = capture ? scenario.capture : scenario.quiet;
  const drawn = capture && (kind === PieceKind.Bishop || kind === PieceKind.Knight);
  await expect(square(page, scenario.from)).toHaveAttribute('aria-label', scenario.from);
  await expect(square(page, target)).toHaveAttribute('aria-label', `${target} ${scenario.colour} ${kind}`);
  await expect(page.locator('.board-square .chess-piece')).toHaveCount(capture ? 3 : 4);
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.history-row--selected strong')).toHaveText(promotionSan(scenario, kind, capture));
  await expect(page.locator('.result-badge')).toHaveText(drawn ? 'drawn' : `${scenario.opponent} to move`);
  if (!capture) await expect(square(page, scenario.capture)).toHaveAttribute('aria-label', `${scenario.capture} ${scenario.opponent} rook`);
  const material = page.getByLabel('Captured material');
  await expect(material).toHaveCount(capture ? 1 : 0);
  if (capture) {
    await expect(material.locator('span')).toHaveCount(1);
    await expect(material.getByRole('img', { name: `${scenario.opponent} rook`, exact: true })).toBeVisible();
    await expect(page.locator('.player-panel').filter({ has: material }).getByRole('button')).toHaveText(scenario.colour === 'white' ? 'White' : 'Black');
  }
}
export function expectPromotedGame(game: IGame, before: IGame, scenario: IPromotionScenario, kind: PieceKind, capture: boolean) {
  const drawn = capture && (kind === PieceKind.Bishop || kind === PieceKind.Knight);
  const check = capture && (kind === PieceKind.Queen || kind === PieceKind.Rook);
  expect(game.rootPosition).toEqual(before.rootPosition);
  expect(game.moveTree.root.children).toHaveLength(1);
  const node = game.moveTree.root.children[0]!;
  expect(node).toMatchObject({ kind: 'live', plyIndex: 1, children: [] });
  expect(node.move).toEqual({ from: scenario.fromId, to: capture ? scenario.captureId : scenario.quietId, kind: MoveKind.Promotion,
    movingColour: scenario.colour, movingPiece: PieceKind.Pawn, promotionPiece: kind,
    ...(capture ? { capturePiece: PieceKind.Rook } : {}), ...(check ? { checkState: CheckState.Check } : {}) });
  expect(game.livePath).toEqual([0]);
  expect(game.renderedPath).toEqual([0]);
  expect(game.resultState).toBe(drawn ? ResultState.Drawn : ResultState.Ongoing);
  expect(game.resultReason).toBe(drawn ? ResultReason.RuleResolved : undefined);
  expect(game.gameState).toBe(scenario.opponent === 'white'
    ? drawn ? GameState.AnalysisWhiteMove : GameState.LiveWhiteTurn
    : drawn ? GameState.AnalysisBlackMove : GameState.LiveBlackTurn);
  expect(game.clockSnapshot.white.isRunning).toBe(false);
  expect(game.clockSnapshot.black.isRunning).toBe(false);
  expect(JSON.stringify(game)).not.toContain('"$"');
}
export async function useBlackOrientation(page: Page) {
  const route = page.url();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByLabel('Orientation', { exact: true }).selectOption('black');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(route);
  await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', /^h1(?: |$)/);
  await expect(page.locator('.board-square').last()).toHaveAttribute('aria-label', /^a8(?: |$)/);
}
