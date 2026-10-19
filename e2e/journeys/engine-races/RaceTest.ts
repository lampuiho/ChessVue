import { test as base, expect } from '../../support/TestEvidence';
export const raceTime = new Date('2026-10-19T12:00:00.000Z');
export const test = base.extend<{ raceClock: void }>({
  raceClock: [async ({ page }, use, testInfo) => {
    await page.clock.install({ time: raceTime });
    await page.clock.setFixedTime(raceTime);
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      const diagnostics = await page.evaluate(() => ({ searches: window.chessVueJourney?.engines.searches(), processes: window.chessVueJourney?.engines.processes() })).catch(() => ({}));
      await testInfo.attach('engine-lifecycle', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
    }
  }, { auto: true }],
});
export { expect };
