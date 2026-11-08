import { expect, type Locator, type Page } from '@playwright/test';

export async function openCustomGame(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /Custom/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Set up a new board', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
/** The creation dialog and the settings form both own a colour toggle, so either surface works here. */
export async function useFixedColours(surface: Page | Locator) {
  const toggle = surface.getByRole('checkbox', { name: /^Randomly assign colours/ });
  // The styled track covers the input, so the toggle is driven through its label text.
  if (await toggle.isChecked()) await surface.getByText('Randomly assign colours', { exact: true }).click();
  await expect(toggle).not.toBeChecked();
}
export async function useLocalPlayers(surface: Page | Locator, blackLabel = 'Black') {
  await useFixedColours(surface);
  await surface.getByLabel(blackLabel, { exact: true }).selectOption('local');
}
export async function setCustomClock(dialog: Locator, minutes = '5', increment = '2') {
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
