import { test as base, expect } from '../../support/TestEvidence';
export const test = base.extend<{ storageCleanup: void }>({
  storageCleanup: [async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00.000Z'));
    await use();
    if (!page.isClosed()) await page.evaluate(() => window.chessVueJourney?.storage.reset());
  }, { auto: true }],
});
export { expect };
