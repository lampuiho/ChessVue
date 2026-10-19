import { expect, type Page } from '@playwright/test';
import { type IGame, type PlayerColour } from '../../../src/contracts';
import { ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { managedFiles, readFile } from '../../support/SaveInspection';
export async function openRules(page: Page, variant: string) {
  await page.goto('/?journey=rules&variant=' + encodeURIComponent(variant) + '&reset=1');
  await waitForJourney(page);
  await expect(page).toHaveURL(new RegExp('/game/rules-' + variant + '$'));
}
export async function reloadRules(page: Page) {
  const route = page.url();
  await page.reload();
  await waitForJourney(page);
  await expect(page).toHaveURL(route);
}
export function expectSameGame(actual: IGame, expected: IGame) {
  expect({ ...actual, metadata: expected.metadata }).toEqual(expected);
}
export async function expectPiece(page: Page, coordinate: string, piece?: string) {
  await expect(square(page, coordinate)).toHaveAttribute('aria-label', coordinate + (piece ? ' ' + piece : ''));
}
export async function expectTargets(page: Page, from: string, targets: readonly string[]) {
  await square(page, from).click();
  const actual = await page.locator('.board-square--target').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')!.split(' ')[0]).sort());
  expect(actual).toEqual([...targets].sort());
  await square(page, from).click();
}
export async function rejectMove(page: Page, from: string, to: string) {
  const before = await saveCurrentGame(page, 'before-illegal');
  const labels = await page.locator('.board-square').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
  const history = await page.locator('.history-row').allTextContents();
  const files = await managedFiles(page);
  const bytes = await Promise.all(files.map((path) => readFile(page, path)));
  await square(page, from).click();
  await expect(square(page, to)).not.toHaveClass(/board-square--target/);
  await square(page, to).click();
  expect(await page.locator('.board-square').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))).toEqual(labels);
  expect(await page.locator('.history-row').allTextContents()).toEqual(history);
  expect(await managedFiles(page)).toEqual(files);
  expect(await Promise.all(files.map((path) => readFile(page, path)))).toEqual(bytes);
  expectSameGame(await saveCurrentGame(page, 'after-illegal'), before);
}
export async function expectCastledBoard(page: Page, colour: PlayerColour, side: 'king' | 'queen') {
  const sq = (coordinate: string) => ruleSquare(coordinate, colour);
  await expectPiece(page, sq('e1'));
  await expectPiece(page, sq(side === 'king' ? 'h1' : 'a1'));
  await expectPiece(page, sq(side === 'king' ? 'g1' : 'c1'), `${colour} king`);
  await expectPiece(page, sq(side === 'king' ? 'f1' : 'd1'), `${colour} rook`);
  await expect(page.locator('.history-row--selected strong')).toHaveText(side === 'king' ? 'O-O' : 'O-O-O');
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.getByLabel('Captured material')).toHaveCount(0);
}
export async function expectEnPassantBoard(page: Page, colour: PlayerColour) {
  const sq = (coordinate: string) => ruleSquare(coordinate, colour);
  await expectPiece(page, sq('e5'));
  await expectPiece(page, sq('d5'));
  await expectPiece(page, sq('d6'), `${colour} pawn`);
  await expect(page.locator('.board-square .chess-piece')).toHaveCount(3);
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(page.locator('.history-row--selected strong')).toHaveText('exd' + sq('d6')[1]);
  await expect(page.getByLabel('Captured material').locator('span')).toHaveCount(1);
  await expect(page.getByLabel('Captured material')).toHaveText(colour === 'white' ? '\u265f' : '\u2659');
}
