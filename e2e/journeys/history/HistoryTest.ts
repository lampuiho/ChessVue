import { test as base, expect } from '../../support/TestEvidence';
export const historyTime = new Date('2026-10-16T12:00:00.000Z');
export const test = base.extend<{ historyClock: void }>({
  historyClock: [async ({ page }, use) => {
    await page.clock.install({ time: historyTime });
    await page.clock.setFixedTime(historyTime);
    await use();
  }, { auto: true }],
});
test.beforeEach(({}, testInfo) => testInfo.setTimeout(60000));
export { expect };
