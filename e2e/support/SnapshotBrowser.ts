import type { Page } from '@playwright/test';
export function snapshotRow(page: Page, name: string) {
  return page.locator('.save-row').filter({ has: page.locator('.save-row__content strong').getByText(name, { exact: true }) });
}
