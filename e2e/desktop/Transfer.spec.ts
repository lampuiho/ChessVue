import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './DesktopTest';
import { createLocalGame, diskGame, managedFiles, openSave, operator, playOpening, waitForPicker } from './DesktopAction';
import { currentGame } from './NativeInspection';
import { expectCanonical } from '../browser/BrowserAction';
import { desktopPickerCancellations } from '../../journeys/definitions/desktop/data/DesktopScenario';

test.skip(process.env.CHESSVUE_DESKTOP_INTERACTIVE !== '1', 'Requires an operator using the real OS pickers.');
for (const action of desktopPickerCancellations) {
  test(`JRN-DESKTOP-02 cancels the native ${action} picker without a write or false success`, async ({ desktop }) => {
    const page = desktop.page;
    const id = await createLocalGame(page);
    await playOpening(page);
    await expect.poll(async () => (await diskGame(desktop.directory, id))?.livePath).toEqual([0]);
    await openSave(page);
    const before = await managedFiles(desktop.directory);
    const url = page.url();
    operator(`Press Cancel in the ${action} picker.`);
    await page.getByRole('button', { name: action, exact: true }).click();
    await waitForPicker(page);
    await expect(page.getByRole('button', { name: action, exact: true })).toBeEnabled();
    expect(page.url()).toBe(url);
    expect(await managedFiles(desktop.directory)).toEqual(before);
    await expect(page.getByText('Game exported.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('JRN-DESKTOP-02 exports imports and confirms native overwrite while preserving managed saves', async ({ desktop }) => {
  const page = desktop.page;
  const id = await createLocalGame(page);
  await playOpening(page);
  await expect.poll(async () => (await diskGame(desktop.directory, id))?.livePath).toEqual([0]);
  const original = await currentGame(page);
  await openSave(page);
  const before = await managedFiles(desktop.directory);
  const target = resolve(desktop.directory, 'Native export Café 棋.json');
  const bytes = await _exportFile(page, target, 'Save the export to exactly');
  expectCanonical(JSON.parse(bytes), original);
  expect(await managedFiles(desktop.directory)).toEqual(before);
  const external = JSON.stringify({ ...original, metadata: { ...original.metadata, name: 'External overwrite marker' } });
  await writeFile(target, external);
  await _declineOverwrite(page, target);
  expect(await readFile(target, 'utf8')).toBe(external);
  expect(await managedFiles(desktop.directory)).toEqual(before);
  expectCanonical(JSON.parse(await _exportFile(page, target, 'Export again and ACCEPT the OS overwrite confirmation')), original);
  expect(await managedFiles(desktop.directory)).toEqual(before);
  operator(`Import this file using the native Open picker: ${target}`);
  await page.getByRole('button', { name: 'Import file', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/, { timeout: 180000 });
  const imported = await currentGame(page);
  expect(imported.metadata.id).not.toBe(id);
  expectCanonical(imported, original, true);
  await expect(page.locator('.history-row')).toHaveCount(1);
  for (const [path, raw] of Object.entries(before)) expect((await managedFiles(desktop.directory))[path]).toBe(raw);
  await desktop.close();
  await desktop.start();
  await expect(desktop.page.locator('.history-row')).toHaveCount(1);
  expectCanonical(await currentGame(desktop.page), imported);
});

async function _exportFile(page: Page, target: string, instruction: string) {
  operator(`${instruction}: ${target}`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await waitForPicker(page);
  await expect(page.locator('.library-feedback')).toContainText('Game exported.', { timeout: 180000 });
  return readFile(target, 'utf8');
}
async function _declineOverwrite(page: Page, target: string) {
  operator(`Choose the same path, decline the OS overwrite confirmation and Cancel the picker: ${target}`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await waitForPicker(page);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await expect(page.getByText('Game exported.', { exact: true })).toHaveCount(0);
}
