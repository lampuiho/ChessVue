import { expect, type Locator, type Page } from '@playwright/test';
import type { IJourneySearch, SearchKind } from '../../../journeys/runtime/engine/JourneyEngineBarrier';
import { openJourney } from '../../support/JourneyBootstrap';
import { selectGame } from '../../support/GameNavigation';
export { analysisSeat } from '../analysis/AnalysisAction';
export async function openRace(page: Page): Promise<void> {
  await openJourney(page, 'engine-races');
  await page.evaluate(() => window.chessVueJourney.engines.hold('player'));
}
export async function heldPlayer(page: Page): Promise<IJourneySearch> {
  await page.getByRole('button', { name: /^Resume game/ }).click();
  return latestSearch(page, 'player');
}
export async function latestSearch(page: Page, kind: SearchKind, path = 'journey://a', after = 0, processId?: number): Promise<IJourneySearch> {
  const read = () => page.evaluate(({ kind, path, after, processId }) => window.chessVueJourney.engines.searches().filter((s) => s.kind === kind && s.path === path && s.id > after && (processId === undefined || s.processId === processId)).at(-1), { kind, path, after, processId });
  await expect.poll(read).toBeTruthy();
  return (await read())!;
}
export async function release(page: Page, id: number): Promise<void> {
  await page.evaluate((id) => window.chessVueJourney.engines.release(id), id);
}
export async function emit(page: Page, id: number, line: string): Promise<void> {
  await page.evaluate(({ id, line }) => window.chessVueJourney.engines.emit(id, line), { id, line });
}
export async function releaseReplacement(page: Page, old: IJourneySearch, seat: Locator): Promise<void> {
  // An already issued intermediate request must drain its own UCI stop boundary too.
  let previous = old.id;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const search = await latestSearch(page, old.kind, old.path, previous, old.processId);
    await release(page, search.id);
    if (await seat.locator('.analysis-line').count() === 3) return;
    previous = search.id;
  }
  await expect(seat.locator('.analysis-line')).toHaveCount(3);
}
export async function openAnalysisRace(page: Page): Promise<IJourneySearch[]> {
  await openRace(page);
  await page.evaluate(() => window.chessVueJourney.engines.hold('analysis'));
  await selectGame(page, 'race-analysis', 'Held analysis searches');
  const after = await page.evaluate(() => window.chessVueJourney.engines.searches().at(-1)?.id ?? 0);
  await page.getByRole('button', { name: 'Refresh analysis', exact: true }).click();
  return [await latestSearch(page, 'analysis', 'journey://a', after), await latestSearch(page, 'analysis', 'journey://b', after)];
}
export async function playerSearchCount(page: Page): Promise<number> {
  return page.evaluate(() => window.chessVueJourney.engines.searches().filter((s) => s.kind === 'player').length);
}
export async function seedIndependentOutput(page: Page): Promise<void> {
  await selectGame(page, 'race-independent', 'Independent analysis game');
  const after = await page.evaluate(() => window.chessVueJourney.engines.searches().at(-1)?.id ?? 0);
  await page.getByRole('button', { name: 'Refresh analysis', exact: true }).click();
  const a = await latestSearch(page, 'analysis', 'journey://a', after);
  const b = await latestSearch(page, 'analysis', 'journey://b', after);
  await release(page, a.id);
  await release(page, b.id);
  await emit(page, a.id, 'info depth 41 score cp 77 pv g1f3 g8f6');
  await selectGame(page, 'race-analysis', 'Held analysis searches');
}
