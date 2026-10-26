import { expect, type Locator, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IGame } from '../../src/contracts';
import { openCustomGame, setCustomClock } from '../support/GameCreation';
import { playMove } from '../support/BoardInteraction';

export async function createLocalGame(page: Page, timed = false) {
  await page.getByRole('button', { name: /Quick game/ }).waitFor();
  if (timed) {
    const dialog = await openCustomGame(page);
    await setCustomClock(dialog, '5', '0');
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click();
  } else await page.getByRole('button', { name: /^Quick game/ }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  return new URL(page.url()).pathname.split('/').pop()!;
}
export async function playOpening(page: Page) {
  await playMove(page, 'e2', 'e4');
  await expect(page.getByRole('button', { name: /^e4 white pawn$/i })).toBeVisible();
  await expect(page.locator('.history-row')).toHaveCount(1);
}
export async function openSave(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/saved-games\/save\/.+/);
}
export async function saveNamed(page: Page, name: string) {
  await openSave(page);
  await page.getByLabel('Save name').fill(name);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.locator('.library-feedback')).toContainText(name);
}
export async function diskGame(directory: string, id: string, name = 'auto'): Promise<IGame | undefined> {
  try { return JSON.parse(await readFile(resolve(directory, 'saves', id, name + '.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
}
export async function managedFiles(directory: string): Promise<Record<string, string>> {
  const root = resolve(directory, 'saves');
  let paths: string[];
  try { paths = await readdir(root, { recursive: true }); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  const files = await Promise.all(paths.filter(path => path.endsWith('.json')).map(async path => [path, await readFile(resolve(root, path), 'utf8')] as const));
  return Object.fromEntries(files);
}
export async function setClosePolicy(page: Page, enabled: boolean) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await setToggle(page.getByLabel('Restore previous session'), enabled);
  await setToggle(page.getByLabel('Save on close'), enabled);
  await page.getByLabel('Autosave interval', { exact: false }).fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
}
export function operator(message: string) { console.log(`\nNATIVE DESKTOP CHECK: ${message}\n`); }
export async function waitForPicker(page: Page) {
  await expect(page.locator('input[type=file]')).toHaveCount(0, { timeout: 180000 });
}

export async function setToggle(control: Locator, checked: boolean) {
  if (await control.isChecked() !== checked) await control.locator('..').click();
  await expect(control).toBeChecked({ checked });
}
