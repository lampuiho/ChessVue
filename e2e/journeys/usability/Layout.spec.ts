import { test, expect } from './UsabilityTest';
import { applyAppearance, expectReachable, expectViewport } from './LayoutAction';
import { openJourney } from '../../support/JourneyBootstrap';
import { openCustomGame } from '../../support/GameCreation';
import { square } from '../../support/BoardInteraction';
import { usabilityGameName, usabilitySaveName } from '../../../journeys/definitions/usability/data/UsabilityScenario';
for (const [width, height] of [[1440, 900], [1024, 768]] as const) for (const scale of [75, 100, 150]) {
  for (const orientation of ['white', 'black']) for (const theme of ['light', 'dark']) {
    test(`JRN-UX-03 keeps controls and long content reachable at ${width}x${height} ${scale}% ${orientation} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await openJourney(page, 'usability');
      await applyAppearance(page, scale, theme, orientation);
      await expectViewport(page);
      const board = await page.locator('.board-grid').boundingBox();
      expect(board!.y + board!.height).toBeLessThanOrEqual(height);
      expect(Math.abs(board!.width - board!.height)).toBeLessThan(1);
      for (const avatar of await page.locator('.player-avatar').all()) {
        const bounds = await avatar.boundingBox();
        expect(Math.abs(bounds!.x - board!.x)).toBeLessThan(1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
      }
      await expect(page.locator('.board-frame')).toHaveCSS('padding', '0px');
      await expect(page.locator('.player-panel').first()).toHaveCSS('border-width', '0px');
      await expectReachable(page, page.locator('.control-panel').getByRole('button').last());
      for (const label of ['Quick game', 'Custom', 'Load', 'Save', 'Close game', 'Settings']) await expectReachable(page, page.getByRole('button', { name: label, exact: true }));
      await expectReachable(page, square(page, 'a8'));
      await expectReachable(page, square(page, 'h1'));
      await expect(page.locator('.board-square').first()).toHaveAccessibleName(new RegExp(orientation === 'white' ? '^a8' : '^h1'));
      await expect(page.locator('.game-sidebar h1')).toHaveText(usabilityGameName);
      await expectReachable(page, page.locator('.history-row--variation').last());
      await page.locator('.history-row--variation').last().click();
      await expectReachable(page, page.getByRole('button', { name: 'Live position', exact: true }));
      await page.getByRole('button', { name: 'Live position', exact: true }).click();
      await testInfo.attach('workspace-layout', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      const dialog = await openCustomGame(page);
      await expectReachable(page, dialog.getByLabel('Name', { exact: false }));
      await expectReachable(page, dialog.getByRole('button', { name: 'Create workspace', exact: true }));
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Load', exact: true }).click();
      await expectReachable(page, page.locator('.game-row'));
      await page.getByRole('button', { name: 'Select game', exact: true }).click();
      const snapshot = page.locator('.save-row__content').filter({ hasText: usabilitySaveName });
      await expectReachable(page, snapshot);
      await snapshot.click();
      await expect(page.getByLabel('Selected save details')).toContainText(usabilityGameName);
      await expectReachable(page, page.getByLabel('Selected save details').getByRole('heading'));
      await expectReachable(page, page.getByRole('button', { name: 'Load selected', exact: true }));
      await testInfo.attach('library-layout', { body: await page.screenshot(), contentType: 'image/png' });
    });
  }
}
