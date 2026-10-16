import { expect, type Page } from '@playwright/test';

export async function selectGame(page: Page, gameId: string, name: string): Promise<void> {
  const tabs = page.getByRole('navigation', { name: 'Open games', exact: true });
  await tabs.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click();
  await expect(page).toHaveURL(new RegExp('/game/' + gameId + '$'));
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
