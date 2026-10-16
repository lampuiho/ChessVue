import { test, expect } from './PlayTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { selectGame } from '../../support/GameNavigation';
import { managedFiles, readSession } from '../../support/SaveInspection';

test('JRN-PLAY-08 @smoke preserves four boards and saves while closing every tab', async ({ page }) => {
  await openJourney(page, 'play');
  await playMove(page, 'g1', 'f3');
  const files = await managedFiles(page);
  await selectGame(page, 'play-mate', 'One move to checkmate');
  await expect(square(page, 'g4')).toHaveAttribute('aria-label', 'g4 white pawn');
  await expect(page.locator('.history-row')).toHaveCount(3);
  await selectGame(page, 'play-drawn', 'Draw by agreement');
  await expect(page.locator('.result-badge')).toHaveText('drawn');
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', 'e2 white pawn');
  await selectGame(page, 'play-resigned', 'White resigned');
  await expect(page.locator('.result-badge')).toHaveText('black won');
  await selectGame(page, 'play-opening', 'Opening with captures');
  await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
  await expect(page.locator('.history-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Close Draw by agreement', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/play-opening$/);
  await page.getByRole('button', { name: 'Close Opening with captures', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/play-mate$/);
  await page.getByRole('button', { name: 'Close White resigned', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Open games', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'One move to checkmate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close game', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.board-grid')).toHaveCount(0);
  await expect.poll(async () => (await readSession(page)).openGameIds).toEqual([]);
  expect(await managedFiles(page)).toEqual(files);
  await page.reload();
  await waitForJourney(page);
  await expect(page).toHaveURL(/\/home$/);
  expect(await managedFiles(page)).toEqual(files);
});
for (const fixture of ['play', 'fresh']) {
  test(`JRN-PLAY-09 redirects an invalid route with ${fixture} and handles Back and Forward`, async ({ page }) => {
    await openJourney(page, fixture);
    await page.getByRole('button', { name: /Settings/ }).click();
    await expect(page).toHaveURL(/\/settings\/session$/);
    // Browser navigation exercises the router's popstate path without accessing application stores.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/game/missing-game');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const fallback = fixture === 'play' ? /\/game\/play-opening$/ : /\/home$/;
    await expect(page).toHaveURL(fallback);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(0);
    if (fixture === 'play') {
      await expect(page.getByRole('heading', { name: 'Opening with captures', exact: true })).toBeVisible();
      await expect(square(page, 'd5')).toHaveAttribute('aria-label', 'd5 black queen');
    } else await expect(page.locator('.board-grid')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/settings\/session$/);
    await page.goForward();
    await expect(page).toHaveURL(fallback);
    await expect(page.locator('.board-grid')).toHaveCount(fixture === 'play' ? 1 : 0);
  });
}
