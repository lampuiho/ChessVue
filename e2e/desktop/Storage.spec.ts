import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from './DesktopTest';
import { createLocalGame, diskGame, managedFiles, openSave, playOpening, saveNamed } from './DesktopAction';
import { currentGame, storageOperation } from './NativeInspection';
import { desktopSaveName } from '../../journeys/definitions/desktop/data/DesktopScenario';
import { expectCanonical } from '../browser/BrowserAction';

test('JRN-DESKTOP-06 reads external changes at a Unicode path and preserves a declined overwrite', async ({ desktop }) => {
  const page = desktop.page;
  const id = await createLocalGame(page);
  await playOpening(page);
  const original = await currentGame(page);
  await saveNamed(page, desktopSaveName);
  const path = resolve(desktop.directory, 'saves', id, desktopSaveName + '.json');
  const external = JSON.parse(await readFile(path, 'utf8'));
  external.metadata.name = 'Externally edited Café 棋';
  const bytes = JSON.stringify(external, null, 2);
  await writeFile(path, bytes);
  expect((await storageOperation(page, 'read', path)).value).toBe(bytes);
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace this save?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readFile(path, 'utf8')).toBe(bytes);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expectCanonical(await currentGame(page), original);
  await openSave(page);
  await page.locator('.save-row').filter({ hasText: desktopSaveName }).getByRole('button').first().click();
  await expect(page.getByRole('complementary', { name: 'Selected save details' })).toContainText(external.metadata.name);
  expect(await readFile(path, 'utf8')).toBe(bytes);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expectCanonical(await currentGame(page), original);
});

test('JRN-DESKTOP-06 recovers when a selected native save disappears before load', async ({ desktop }) => {
  const page = desktop.page;
  const id = await createLocalGame(page);
  await playOpening(page);
  await saveNamed(page, 'Removed selection');
  const path = resolve(desktop.directory, 'saves', id, 'Removed selection.json');
  const bytes = await readFile(path, 'utf8');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Select game', exact: true }).click();
  await page.locator('.save-row').filter({ hasText: 'Removed selection' }).getByRole('button').first().click();
  await expect(page.getByRole('complementary', { name: 'Selected save details' })).toContainText('1 plies');
  await unlink(path);
  expect((await storageOperation(page, 'read', path)).kind).toBe('notFound');
  const url = page.url();
  await page.getByRole('button', { name: 'Load selected', exact: true }).click();
  await expect(page.locator('.library-feedback--error')).toBeVisible();
  expect(page.url()).toBe(url);
  await writeFile(path, bytes);
  await page.reload();
  await page.locator('.save-row').filter({ hasText: 'Removed selection' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Load selected', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  expect((await currentGame(page)).metadata.id).not.toBe(id);
  expect(await readFile(path, 'utf8')).toBe(bytes);
});

test('JRN-DESKTOP-06 reports missing and unwritable native targets and allows an explicit retry', async ({ desktop }) => {
  const page = desktop.page;
  const id = await createLocalGame(page);
  await playOpening(page);
  await expect.poll(async () => (await diskGame(desktop.directory, id))?.livePath).toEqual([0]);
  const missing = resolve(desktop.directory, 'missing parent', 'target.json');
  expect((await storageOperation(page, 'read', missing)).kind).toBe('notFound');
  expect((await storageOperation(page, 'write', missing, '{}')).kind).toBe('notFound');
  await saveNamed(page, 'Protected');
  const protectedPath = resolve(desktop.directory, 'saves', id, 'Protected.json');
  const bytes = await readFile(protectedPath, 'utf8');
  const before = await managedFiles(desktop.directory);
  await chmod(protectedPath, 0o444);
  try {
    expect((await storageOperation(page, 'write', protectedPath, 'replacement', true)).kind).toBe('permissionDenied');
    await page.getByRole('button', { name: 'Save game', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Replace this save?', exact: true });
    await dialog.getByRole('button', { name: 'Replace save', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('could not be written');
    expect(await readFile(protectedPath, 'utf8')).toBe(bytes);
    expect(await managedFiles(desktop.directory)).toEqual(before);
  } finally { await chmod(protectedPath, 0o666); }
  await page.getByRole('dialog').getByRole('button', { name: 'Replace save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.library-feedback')).toContainText('Protected');
  expect((await diskGame(desktop.directory, id, 'Protected'))?.livePath).toEqual([0]);
});

test('JRN-DESKTOP-06 exclusively creates native files when an external writer races the save', async ({ desktop }) => {
  const directory = resolve(desktop.directory, 'external writers Café 棋');
  await mkdir(directory);
  const path = resolve(directory, 'collision.json');
  const results = await Promise.all([
    storageOperation(desktop.page, 'write', path, 'first'),
    storageOperation(desktop.page, 'write', path, 'second'),
  ]);
  expect(results.filter(result => result.kind === 'alreadyExists')).toHaveLength(1);
  expect(results.filter(result => !result.kind)).toHaveLength(1);
  const written = await readFile(path, 'utf8');
  expect(['first', 'second']).toContain(written);
  expect((await storageOperation(desktop.page, 'write', path, 'third')).kind).toBe('alreadyExists');
  expect(await readFile(path, 'utf8')).toBe(written);
});
