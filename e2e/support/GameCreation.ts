import { expect, type Locator, type Page } from '@playwright/test';

export async function openCustomGame(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /Custom/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Set up a new board', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function setCustomClock(dialog: Locator, minutes = '5', increment = '2'): Promise<void> {
  await dialog.getByLabel('Clock', { exact: true }).selectOption('custom');
  await dialog.getByLabel('Minutes', { exact: true }).fill(minutes);
  await dialog.getByLabel('Increment (seconds)', { exact: true }).fill(increment);
}
export async function createWorkspace(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  return page.url().split('/').pop()!;
}
