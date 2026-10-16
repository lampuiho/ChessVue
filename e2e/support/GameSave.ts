import { expect, type Page } from '@playwright/test';
import { readGame } from './SaveInspection';

export async function saveCurrentGame(page: Page, saveName: string) {
  const gameId = page.url().split('/').pop()!;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Save name').fill(saveName);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.locator('.library-feedback')).toContainText(`Saved “${saveName}”.`);
  const game = await readGame(page, `saves/${gameId}/${saveName}.json`);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/game/' + gameId + '$'));
  return game;
}
