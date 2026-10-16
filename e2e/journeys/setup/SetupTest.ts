import { test as base, expect } from '../../support/TestEvidence';
export const setupTime = new Date('2026-10-16T12:00:00.000Z');
export const test = base.extend<{ setupClock: void }>({
  setupClock: [async ({ page }, use) => {
    await page.clock.install({ time: setupTime });
    await page.clock.setFixedTime(setupTime);
    await use();
  }, { auto: true }],
});
export { expect };
