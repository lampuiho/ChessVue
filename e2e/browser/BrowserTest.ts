import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ browserEvidence: void }>({
  browserEvidence: [async ({ context }, use, testInfo) => {
    const errors: string[] = [];
    const capturePage = (page: import('@playwright/test').Page) => page.on('pageerror', (error) => errors.push(error.message));
    context.pages().forEach(capturePage);
    context.on('page', capturePage);
    await use();
    context.off('page', capturePage);
    if (testInfo.status !== testInfo.expectedStatus || errors.length) {
      await testInfo.attach('browser-storage', { body: JSON.stringify(await context.storageState()), contentType: 'application/json' });
      await testInfo.attach('page-errors', { body: JSON.stringify(errors), contentType: 'application/json' });
    }
    expect(errors, 'Uncaught browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
