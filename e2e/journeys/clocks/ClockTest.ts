import { test as base, expect } from '../../support/TestEvidence';
export const clockTime = new Date('2026-10-17T12:00:00.000Z');
export const test = base.extend<{ controlledClock: void }>({
  controlledClock: [async ({ page }, use) => {
    await page.clock.install({ time: clockTime });
    await page.clock.setFixedTime(clockTime);
    await use();
  }, { auto: true }],
});
export { expect };
