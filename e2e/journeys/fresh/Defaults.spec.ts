import { test, expect } from '../../support/TestEvidence';
import { openJourney } from '../../support/JourneyBootstrap';
import { createWorkspace, openCustomGame } from '../../support/GameCreation';
import { configureEngines } from '../../support/EngineInventory';
import { saveCurrentGame } from '../../support/GameSave';
import { readFile } from '../../support/SaveInspection';
import { selectGame } from '../../support/GameNavigation';
import type { Page } from '@playwright/test';

async function changeDefaults(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Gameplay', exact: true }).click();
  await page.getByLabel('Game name', { exact: true }).fill('Default match');
  await page.getByLabel('Black player', { exact: true }).selectOption('engine');
  await page.getByLabel('Clock preset', { exact: true }).selectOption('blitz');
  await page.getByLabel('Initial time (milliseconds)', { exact: true }).fill('300000');
  await page.getByLabel('Increment (milliseconds)', { exact: true }).fill('2000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
test('JRN-FRESH-09 applies defaults to future games and preserves an existing game', async ({ page }) => {
  await openJourney(page, 'fresh');
  await configureEngines(page, [{ name: 'Journey A', path: 'journey://a' }]);
  await page.getByRole('button', { name: /Quick game/ }).click();
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  const existing = await saveCurrentGame(page, 'Original');
  const existingPath = `saves/${existing.metadata.id}/Original.json`;
  const before = await readFile(page, existingPath);
  await changeDefaults(page);
  await page.getByRole('button', { name: 'Quick game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Default match', exact: true })).toBeVisible();
  const quick = await saveCurrentGame(page, 'Quick defaults');
  expect([quick.whitePlayer?.type, quick.blackPlayer?.type]).toEqual(['local', 'local']);
  expect(quick.timeControl).toEqual({ preset: 'blitz', initialMs: 300000, incrementMs: 2000 });
  const dialog = await openCustomGame(page);
  await expect(dialog.getByLabel('Name')).toHaveValue('Default match');
  await expect(dialog.getByLabel('Black', { exact: true }).locator('option:checked')).toHaveText('Journey A');
  await createWorkspace(page);
  const custom = await saveCurrentGame(page, 'Custom defaults');
  expect(custom.blackPlayer?.type).toBe('engine');
  expect(custom.timeControl).toEqual(quick.timeControl);
  await selectGame(page, existing.metadata.id, existing.metadata.name);
  const preserved = await saveCurrentGame(page, 'Existing options');
  expect(preserved.timeControl).toEqual(existing.timeControl);
  expect([preserved.whitePlayer, preserved.blackPlayer]).toEqual([existing.whitePlayer, existing.blackPlayer]);
  expect(preserved.gameplayOptions).toEqual(existing.gameplayOptions);
  expect(await readFile(page, existingPath)).toBe(before);
});
