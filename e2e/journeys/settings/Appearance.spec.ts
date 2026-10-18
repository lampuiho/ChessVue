import { test, expect } from './SettingsTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { acceptedSettings, applySettings, openSettings, returnToGame, setSettingToggle } from './SettingsAction';
for (const orientation of ['white', 'black']) {
  test(`JRN-SETTINGS-01 applies and restores appearance with ${orientation} board input @smoke`, async ({ page }) => {
    await openJourney(page, 'settings');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('radio', { name: 'light', exact: true }).check();
    await page.getByLabel('Orientation', { exact: true }).selectOption(orientation);
    await setSettingToggle(page, 'Coordinates', false);
    await setSettingToggle(page, 'Last move highlight', false);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await applySettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await returnToGame(page);
    await expect(page.locator('.board-square').first()).toHaveAttribute('aria-label', new RegExp('^' + (orientation === 'white' ? 'a8' : 'h1')));
    await expect(page.locator('.coordinate, .board-square--last')).toHaveCount(0);
    await playMove(page, 'g1', 'f3');
    await expect(square(page, 'f3').locator('.chess-piece')).toHaveCount(1);
    await expect(square(page, 'g1').locator('.chess-piece')).toHaveCount(0);
    await expect(page.locator('.history-row')).toHaveCount(3);
    const game = await saveCurrentGame(page, 'Appearance input');
    expect(game.livePath).toHaveLength(3);
    await page.reload();
    await waitForJourney(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.coordinate, .board-square--last')).toHaveCount(0);
    await expect(square(page, 'f3').locator('.chess-piece')).toHaveCount(1);
    await openSettings(page, 'Appearance');
    await setSettingToggle(page, 'Coordinates', true);
    await setSettingToggle(page, 'Last move highlight', true);
    await applySettings(page);
    await returnToGame(page);
    await expect(page.locator('.coordinate')).toHaveCount(16);
    await expect(page.locator('.board-square--last')).toHaveCount(2);
  });
}
for (const mode of ['system', 'light', 'dark']) {
  test(`JRN-SETTINGS-02 responds to host changes in ${mode} mode after repeated navigation`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openJourney(page, 'settings');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.getByRole('radio', { name: mode, exact: true }).check();
    if (mode !== 'dark') await applySettings(page);
    const before = await acceptedSettings(page);
    for (let visit = 0; visit < 3; visit++) {
      await returnToGame(page);
      await openSettings(page, 'Appearance');
      for (const host of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme: host });
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode === 'system' ? host : mode);
        expect(await acceptedSettings(page)).toEqual(before);
      }
    }
  });
}
