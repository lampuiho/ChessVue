import { expect, type Page } from '@playwright/test';

export async function configureEngines(page: Page, profiles: { name: string; path: string }[]) {
  const returnPath = new URL(page.url()).pathname;
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Engines', exact: true }).click();
  for (const profile of profiles) {
    await page.getByRole('button', { name: 'Add engine', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add engine profile', exact: true });
    await dialog.getByLabel('Display name', { exact: true }).fill(profile.name);
    await dialog.getByLabel('Engine location').fill(profile.path);
    await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(returnPath.startsWith('/game/') ? returnPath + '$' : '/home$'));
}
