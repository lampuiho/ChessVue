import type { Page } from '@playwright/test';
import { test, expect } from './UsabilityTest';
import { keyboardActivate, keyboardReach, expectVisibleFocus, expectFocusInside } from './KeyboardAction';
import { openJourney } from '../../support/JourneyBootstrap';
import { square } from '../../support/BoardInteraction';
import { readGame } from '../../support/SaveInspection';
test('JRN-UX-01 completes Home creation, a board move, Save and Settings using only the keyboard', async ({ page }) => {
  await openJourney(page, 'sessions');
  const id = await _createKeyboardStudy(page);
  await keyboardActivate(page, square(page, 'e2'));
  await expect(square(page, 'e2')).toHaveAttribute('aria-pressed', 'true');
  await keyboardActivate(page, square(page, 'e4'), true);
  await expect(square(page, 'e4')).toHaveAccessibleName('e4 white pawn');
  await keyboardActivate(page, page.getByRole('button', { name: 'Save', exact: true }), true);
  await keyboardReach(page, page.getByLabel('Save name', { exact: false }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('Keyboard snapshot');
  await page.keyboard.press('Enter');
  await expect(page.locator('.library-feedback')).toContainText('Keyboard snapshot');
  expect((await readGame(page, `saves/${id}/Keyboard snapshot.json`)).livePath).toHaveLength(1);
  await keyboardActivate(page, page.getByRole('button', { name: 'Close', exact: true }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Settings', exact: true }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Appearance', exact: true }));
  await _checkSettingsFocus(page);
  await keyboardActivate(page, page.getByRole('button', { name: 'Back to game', exact: true }), true);
  await expect(square(page, 'e4')).toHaveAccessibleName('e4 white pawn');
});
for (const colour of ['white', 'black'] as const) {
  test(`JRN-UX-01 names and completes ${colour} promotion choices with keyboard cancellation`, async ({ page }) => {
    await openJourney(page, 'promotion');
    if (colour === 'black') await keyboardActivate(page, page.locator('.tab-button').filter({ hasText: 'black to promote' }));
    const from = colour === 'white' ? 'a7' : 'h2';
    const to = colour === 'white' ? 'a8' : 'h1';
    await keyboardActivate(page, square(page, from));
    await keyboardActivate(page, square(page, to), colour === 'white');
    const chooser = page.getByRole('group', { name: 'Pawn promotion', exact: true });
    await expectFocusInside(chooser);
    for (const kind of ['queen', 'rook', 'bishop', 'knight']) await expect(chooser.getByRole('button', { name: `Promote to ${colour} ${kind}`, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(chooser).toHaveCount(0);
    await expect(square(page, to)).toBeFocused();
    await keyboardActivate(page, square(page, from));
    await keyboardActivate(page, square(page, to), colour === 'white');
    await keyboardActivate(page, chooser.getByRole('button', { name: `Promote to ${colour} knight`, exact: true }));
    await expect(chooser).toHaveCount(0);
    await expect(square(page, to)).toHaveAccessibleName(`${to} ${colour} knight`);
  });
}
async function _createKeyboardStudy(page: Page) {
  const custom = page.getByRole('button', { name: /Custom game/ });
  await keyboardActivate(page, custom);
  const dialog = page.getByRole('dialog', { name: 'Set up a new board', exact: true });
  const name = dialog.getByLabel('Name', { exact: false });
  await expect(name).toBeFocused();
  await expectVisibleFocus(name);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(custom).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(name).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('Keyboard study');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/game\/[^/]+$/);
  return page.url().split('/').pop()!;
}
async function _checkSettingsFocus(page: Page) {
  const coordinates = page.getByRole('checkbox', { name: 'Coordinates', exact: true });
  await keyboardReach(page, coordinates);
  await expect(coordinates.locator('..').locator('.toggle-track')).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await expect(coordinates).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(coordinates).toBeChecked();
  const theme = page.getByRole('radio', { name: 'system', exact: true });
  await keyboardReach(page, theme);
  await expect(theme.locator('..')).toHaveCSS('outline-style', 'solid');
  await keyboardReach(page, page.getByRole('slider', { name: 'Interface scale', exact: true }));
  await expectVisibleFocus(page.getByRole('slider'));
  for (const control of await page.getByRole('checkbox').all()) await expect(control).toHaveAccessibleName(/\S/);
}
