import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ journeyEvidence: void }>({
  journeyEvidence: [async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    const _captureError = (error: Error) => errors.push(error.message);
    page.on('pageerror', _captureError);
    await use();
    page.off('pageerror', _captureError);
    if (testInfo.status !== testInfo.expectedStatus || errors.length) {
      const files = await page.evaluate(() => {
        const api = window.chessVueJourney;
        if (!api) return {};
        return Object.fromEntries(api.listFiles().map((path) => [path, api.readFile(path)]));
      }).catch(() => ({}));
      await testInfo.attach('journey-files', { body: JSON.stringify(files, null, 2), contentType: 'application/json' });
      await testInfo.attach('page-errors', { body: JSON.stringify(errors), contentType: 'application/json' });
      if (!page.isClosed()) await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });
    }
    expect(errors, 'Uncaught browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
