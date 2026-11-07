import { expect, type Page } from '@playwright/test';
export function gameResultDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Game over', exact: true });
}
export async function expectGameResult(page: Page, sentence: string) {
  const dialog = gameResultDialog(page);
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toContainText(sentence);
}
export async function dismissGameResult(page: Page) {
  await gameResultDialog(page).getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function settleGameResult(page: Page, sentence: string) {
  await expectGameResult(page, sentence);
  await dismissGameResult(page);
}
