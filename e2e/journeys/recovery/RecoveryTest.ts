import { test as base, expect } from '../../support/TestEvidence';
export const test = base.extend<{ recoveryClock: void }>({
  recoveryClock: [async ({ page }, use) => {
    await page.clock.install({ time: new Date('2026-10-18T12:00:00.000Z') });
    await page.clock.setFixedTime(new Date('2026-10-18T12:00:00.000Z'));
    await use();
  }, { auto: true }],
});
test.use({ actionTimeout: 15000, navigationTimeout: 60000 });
export { expect };
