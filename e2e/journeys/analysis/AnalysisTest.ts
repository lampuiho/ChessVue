import { test as base, expect } from '../../support/TestEvidence';
export const analysisTime = new Date('2026-10-16T12:00:00.000Z');
export const test = base.extend<{ analysisClock: void }>({
  analysisClock: [async ({ page }, use) => {
    await page.clock.install({ time: analysisTime });
    await page.clock.setFixedTime(analysisTime);
    await use();
  }, { auto: true }],
});
test.beforeEach(({}, testInfo) => testInfo.setTimeout(60000));
export { expect };
