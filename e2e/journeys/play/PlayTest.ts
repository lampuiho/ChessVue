import { test as base, expect } from '../../support/TestEvidence';
import { playTime } from './PlaySetup';

export const test = base.extend<{ playClock: void }>({
  playClock: [async ({ page }, use) => {
    await page.clock.install({ time: playTime });
    await page.clock.setFixedTime(playTime);
    await use();
  }, { auto: true }],
});
test.beforeEach(({}, testInfo) => testInfo.setTimeout(60000));
export { expect };
