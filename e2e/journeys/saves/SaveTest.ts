import { test as base, expect } from '../../support/TestEvidence';
export const test = base.extend<{ saveClock: void }>({
  saveClock: [async ({ page }, use) => {
    const time = new Date('2026-10-17T12:00:00.000Z');
    await page.clock.setFixedTime(time);
    await use();
  }, { auto: true }],
});
export { expect };
