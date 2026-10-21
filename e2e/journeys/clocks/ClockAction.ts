import { expect, type Page } from '@playwright/test';
import { openJourney } from '../../support/JourneyBootstrap';
import { openCustomGame, createWorkspace } from '../../support/GameCreation';
import type { ClockMenu } from '../../../journeys/definitions/clocks/data/ClockScenario';
export function playerClock(page: Page, colour: 'white' | 'black') {
  return page.locator('.player-panel').filter({ has: page.locator(`.player-avatar .piece-artwork--${colour}`) }).locator('.player-clock');
}
export async function advanceClock(page: Page, milliseconds: number) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(new Date(now + milliseconds));
  await page.clock.runFor(250);
}
export async function resumeClock(page: Page) {
  await page.getByRole('button', { name: /^Resume game/ }).click();
  await expect(page.getByRole('heading', { name: 'Game controls', exact: true })).toBeVisible();
}
export async function selectClockGame(page: Page, name: string) {
  await page.locator('.tab-button').filter({ has: page.locator('.tab-button__label').getByText(name, { exact: true }) }).click();
}
export async function openClockMenu(page: Page, menu: ClockMenu) {
  await page.getByRole('button', { name: menu, exact: true }).click();
  if (menu === 'Custom') await expect(page.getByRole('dialog', { name: 'Set up a new board', exact: true })).toBeVisible();
  else await expect(page).toHaveURL(menu === 'Settings' ? /\/settings\/session$/ : /\/saved-games\//);
}
export async function closeClockMenu(page: Page, menu: ClockMenu) {
  if (menu === 'Custom') await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  else await page.getByRole('button', { name: menu === 'Settings' ? 'Back to game' : 'Close', exact: true }).click();
  await expect(page).toHaveURL(/\/game\//);
}
export async function disableMenuPause(page: Page) {
  await openClockMenu(page, 'Settings');
  await page.locator('.field-row').filter({ hasText: 'Auto-pause on menu' }).locator('.toggle-row').click();
  await page.locator('.settings-actions').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/game\//);
}
export async function openRunningClock(page: Page, name = 'Two-minute clock + 2 seconds') {
  await openJourney(page, 'clocks');
  if (name !== 'Two-minute clock + 2 seconds') await selectClockGame(page, name);
  await resumeClock(page);
}
export async function createUntimedClock(page: Page) {
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill('Untimed clock control');
  await dialog.getByLabel('Clock', { exact: true }).selectOption('untimed');
  await createWorkspace(page);
}
export async function expectTimeout(page: Page, winner = 'Black') {
  const dialog = page.getByRole('dialog', { name: 'Time has expired', exact: true });
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toContainText(`${winner} wins on time.`);
}
export async function dismissTimeout(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Review game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Game review', exact: true })).toBeVisible();
}
