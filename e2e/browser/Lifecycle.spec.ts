import { test, expect } from './BrowserTest';
import { createGame, expectCanonical, exportGame, playOpening, saveNamedGame } from './BrowserAction';
import { browserFiles, browserGame, gameId } from './BrowserStorage';
import { playMove } from '../support/BoardInteraction';
import { browserCheckpointEvents } from '../../journeys/definitions/browser/data/BrowserScenario';

for (const event of browserCheckpointEvents) {
  test(`JRN-BROWSER-06 persists completed ${event} checkpoints and explicit saves before closing the page`, async ({ page, context }) => {
    await createGame(page);
    const id = gameId(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Autosave interval', { exact: false }).fill('0');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const before = await browserGame(page, id);
    await playOpening(page);
    expect(await browserGame(page, id)).toEqual(before);
    // Dispatch the browser boundary while the page can finish its async checkpoint.
    await page.evaluate((kind) => {
      if (kind === 'pagehide') window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      else {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        Reflect.deleteProperty(document, 'visibilityState');
      }
    }, event);
    await expect.poll(async () => (await browserGame(page, id))?.livePath).toEqual([0]);
    const checkpoint = (await browserGame(page, id))!;
    await page.reload();
    await expect(page.locator('.history-row')).toHaveCount(1);
    expectCanonical(await exportGame(page), checkpoint);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await playMove(page, 'e7', 'e5');
    await saveNamedGame(page, 'Completed explicit save');
    const named = Object.entries(await browserFiles(page)).find(([path]) => path.startsWith(`saves/${id}/`) && !path.endsWith('/auto.json'))!;
    expect(JSON.parse(named[1]).livePath).toEqual([0, 0]);
    // Only the already completed writes are guaranteed by this close/reopen check.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto('/');
    expect((await browserFiles(reopened))[named[0]]).toBe(named[1]);
    await expect(reopened.locator('.save-row__content')).toContainText(['Completed explicit save']);
    await reopened.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(reopened.locator('.history-row')).toHaveCount(2);
    expectCanonical(await exportGame(reopened), JSON.parse(named[1]));
  });
}
