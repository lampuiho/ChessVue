import { expect, type Locator, type Page } from '@playwright/test';
import type { ISettingsSnapshot } from '../../../src/contracts';
import { readFile } from '../../support/SaveInspection';
export async function acceptedSettings(page: Page): Promise<ISettingsSnapshot> {
  return JSON.parse((await readFile(page, 'settings.json'))!) as ISettingsSnapshot;
}
export function settingToggle(page: Page, label: string): Locator {
  return page.locator('.field-row').filter({ has: page.locator('.field-label').filter({ hasText: label }) }).getByRole('checkbox');
}
export async function setSettingToggle(page: Page, label: string, checked: boolean): Promise<void> {
  const checkbox = settingToggle(page, label);
  if (await checkbox.isChecked() !== checked) await checkbox.locator('..').click();
  await expect(checkbox).toBeChecked({ checked });
}
export function profileRow(page: Page, name: string): Locator {
  return page.locator('.engine-list article').filter({ has: page.getByText(name, { exact: true }) });
}
export async function returnToGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back to game', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/settings-game$/);
}
export async function openSettings(page: Page, category = 'Engines'): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: category, exact: true }).click();
}
export async function applySettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(page.locator('.unsaved-badge')).toHaveCount(0);
  await expect(page.locator('.settings-feedback')).toHaveText('Settings applied.');
}
export async function editProfile(page: Page, name?: string): Promise<Locator> {
  if (name) await profileRow(page, name).getByTitle('Edit', { exact: true }).click();
  else await page.getByRole('button', { name: 'Add engine', exact: true }).click();
  return page.getByRole('dialog', { name: name ? 'Edit engine profile' : 'Add engine profile', exact: true });
}
export async function addOption(dialog: Locator, name: string, value: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Add option', exact: true }).click();
  const row = dialog.locator('.option-list > div').last();
  await row.getByPlaceholder('Option name', { exact: true }).fill(name);
  await row.getByPlaceholder('Value', { exact: true }).fill(value);
}
export async function saveProfile(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
