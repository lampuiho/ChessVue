import { test, expect } from './SaveTest';
import { playMove, square } from '../../support/BoardInteraction';
import { readSession } from '../../support/SaveInspection';
import { saveCurrentGame } from '../../support/GameSave';
import { fileSnapshot, openLibraryGame, setAutosaveInterval } from './SaveAction';
for (const target of ['unopened', 'open']) {
  test(`JRN-SAVE-13 reopens ${target} recent game with its latest appropriate workspace`, async ({ page }) => {
    await openLibraryGame(page);
    await setAutosaveInterval(page, 0);
    await playMove(page, 'f1', 'b5');
    const before = await fileSnapshot(page);
    await page.getByRole('button', { name: 'ChessVue home', exact: true }).click();
    const name = target === 'open' ? 'Library middlegame' : 'Second saved game';
    await page.locator('.recent-card').filter({ hasText: name }).click();
    await expect(page).toHaveURL(new RegExp('/game/' + (target === 'open' ? 'save-library' : 'save-other') + '$'));
    await expect(page.locator('.history-row')).toHaveCount(target === 'open' ? 5 : 2);
    await expect(square(page, target === 'open' ? 'b5' : 'd4')).toHaveAttribute('aria-label', target === 'open' ? 'b5 white bishop' : 'd4 white pawn');
    expect(await fileSnapshot(page)).toEqual(before);
    const session = await readSession(page);
    expect(session.openGameIds).toEqual(target === 'open' ? ['save-library'] : ['save-library', 'save-other']);
    expect((await saveCurrentGame(page, 'Recent workspace')).renderedPath).toHaveLength(target === 'open' ? 5 : 2);
  });
}
for (const fault of ['missing', 'corrupt']) {
  test(`JRN-SAVE-13 refreshes a ${fault} unopened recent target without inserting a workspace`, async ({ page }) => {
    await openLibraryGame(page);
    await page.getByRole('button', { name: 'ChessVue home', exact: true }).click();
    const before = await readSession(page);
    const original = await fileSnapshot(page);
    await expect(page.locator('.recent-card').filter({ hasText: 'Second saved game' })).toHaveCount(1);
    await page.evaluate((mode) => {
      const api = window.chessVueJourney;
      if (mode === 'missing') for (const path of api.listFiles().filter((path) => path.startsWith('saves/save-other/'))) api.changeFile(path, null);
      else api.changeFile('saves/save-other/auto.json', '{broken');
    }, fault);
    const changed = await fileSnapshot(page);
    await page.locator('.recent-card').filter({ hasText: 'Second saved game' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('.recent-card').filter({ hasText: 'Second saved game' })).toHaveCount(0);
    await expect(page.locator('.home-error')).toBeVisible();
    expect(await readSession(page)).toEqual(before);
    expect(await fileSnapshot(page)).toEqual(changed);
    expect(changed['saves/save-library/auto.json']).toBe(original['saves/save-library/auto.json']);
    await page.locator('.recent-card').filter({ hasText: 'Library middlegame' }).click();
    await expect(page).toHaveURL(/\/game\/save-library$/);
  });
}
