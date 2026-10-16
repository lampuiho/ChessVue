import { expect, type Page } from '@playwright/test';
import { openCustomGame, createWorkspace, setCustomClock } from '../../support/GameCreation';
import { readGame } from '../../support/SaveInspection';

export const playTime = new Date('2026-10-15T12:00:00.000Z');
export async function createTimedPlay(page: Page, allowTakeback = true): Promise<string> {
  await page.clock.setFixedTime(playTime);
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill('Timed play');
  await setCustomClock(dialog);
  if (!allowTakeback) await dialog.getByText('Allow takebacks', { exact: true }).click();
  return createWorkspace(page);
}
export async function choosePlayer(page: Page, colour: 'White' | 'Black', choice: string): Promise<void> {
  const panel = page.locator('.player-panel').filter({ has: page.locator('.player-meta span').getByText(colour, { exact: true }) });
  await panel.locator('.player-name').click();
  const dialog = page.getByRole('dialog', { name: 'Choose a player', exact: true });
  await dialog.getByRole('radio', { name: choice, exact: false }).check();
  await dialog.getByRole('button', { name: 'Assign player', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
export function autoSave(page: Page, id: string) {
  return readGame(page, `saves/${id}/auto.json`);
}
export async function expectStoppedClock(page: Page): Promise<void> {
  const clocks = await page.locator('.player-clock').allTextContents();
  await page.clock.setFixedTime(new Date(playTime.getTime() + 60000));
  await page.clock.runFor(1000);
  await expect.poll(() => page.locator('.player-clock').allTextContents()).toEqual(clocks);
  await expect(page.getByRole('dialog', { name: 'Time has expired' })).toHaveCount(0);
}
