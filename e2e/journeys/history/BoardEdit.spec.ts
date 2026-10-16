import { test, expect } from './HistoryTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';

for (const mode of ['analysis', 'finished']) {
  test(`JRN-HIST-08 keeps free-board editing unavailable in ${mode} game controls`, async ({ page }) => {
    await openJourney(page, 'history');
    if (mode === 'analysis') await page.getByRole('button', { name: /Analyse/ }).click();
    else {
      await page.getByRole('button', { name: 'Resign', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Resign', exact: true }).click();
    }
    const before = await saveCurrentGame(page, 'before-inspection');
    await expect(page.getByRole('heading', { name: mode === 'analysis' ? 'Analysis mode' : 'Game review', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit board|Clear board|Reset board|Finish editing|Start game/ })).toHaveCount(0);
    await expect(page.locator('.piece-palette')).toHaveCount(0);
    const after = await saveCurrentGame(page, 'after-inspection');
    expect(after.moveTree).toEqual(before.moveTree);
    expect(after.rootPosition).toEqual(before.rootPosition);
    expect(after.resultState).toBe(before.resultState);
  });
}
