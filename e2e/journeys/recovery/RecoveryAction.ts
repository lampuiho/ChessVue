import { expect, type Page } from '@playwright/test';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { readFile, readSession } from '../../support/SaveInspection';
export async function openRecovery(page: Page, variant = 'combined') {
  await page.goto('/?journey=recovery&variant=' + encodeURIComponent(variant) + '&reset=1');
  await waitForJourney(page);
}
export async function expectSession(page: Page, ids: readonly string[], route: string, activeGameId?: string) {
  await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await expect.poll(() => readSession(page)).toEqual({ schemaVersion: 1, openGameIds: [...ids], activeRoute: route, ...(activeGameId ? { activeGameId } : {}) });
  await expect(page.locator('.app-loading')).toHaveCount(0);
}
export async function sourceFiles(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => Object.fromEntries(window.chessVueJourney.listFiles()
    .filter((path) => path !== 'game-session.json' && path !== 'layout-state.json')
    .map((path) => [path, window.chessVueJourney.readFile(path)])));
}
export async function expandHistory(page: Page) {
  const expand = page.getByRole('button', { name: 'Expand history', exact: true });
  if (await expand.count()) await expand.click();
}
export async function expectLayout(page: Page, collapsed: boolean) {
  await expect(page.getByRole('button', { name: collapsed ? 'Expand history' : 'Collapse history', exact: true })).toBeVisible();
  await expect(page.locator('.analysis-panel')).toBeVisible();
}
export async function reloadRecovery(page: Page) {
  await page.reload();
  await waitForJourney(page);
}
export async function expectOriginalFaults(page: Page) {
  expect(await readFile(page, 'settings.json')).toBe('{ corrupt settings');
  expect(await readFile(page, 'layout-state.json')).toBe('{ corrupt layout');
  expect(await readFile(page, 'saves/recovery-broken/auto.json')).toBe('{"schemaVersion":99}');
  expect(await readFile(page, 'saves/recovery-missing/auto.json')).toBeUndefined();
}
