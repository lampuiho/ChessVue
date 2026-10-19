import { type Locator, type Page } from '@playwright/test';

export function square(page: Page, coordinate: string): Locator {
  return page.getByRole('button', { name: new RegExp('^' + coordinate + '(?: |$)', 'i') });
}
export async function playMove(page: Page, from: string, to: string) {
  await square(page, from).click();
  await square(page, to).click();
}
