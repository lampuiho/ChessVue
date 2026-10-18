import { test, expect } from './SaveTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { readGame, readSession } from '../../support/SaveInspection';
import { expectCanonical, fileSnapshot, reloadSaved, snapshotRow } from './SaveAction';
for (const identity of ['collision', 'mismatched']) {
  test(`JRN-SAVE-14 repairs ${identity} managed identity before the next write`, async ({ page }) => {
    await openJourney(page, 'saves');
    const path = identity === 'collision' ? 'saves/save-library/Opening.json' : 'saves/save-other/Mismatched.json';
    const expected = await readGame(page, path);
    const before = await fileSnapshot(page);
    if (identity === 'mismatched') {
      await page.locator('.app-header').getByRole('button', { name: 'Load', exact: true }).click();
      await page.locator('.game-row').filter({ hasText: 'Second saved game' }).click();
      await page.getByRole('button', { name: 'Select game', exact: true }).click();
    }
    await snapshotRow(page, identity === 'collision' ? 'Opening' : 'Mismatched').locator('.save-row__content').click();
    await page.getByRole('button', { name: 'Load selected', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
    const id = page.url().split('/').pop()!;
    if (identity === 'mismatched') expect(id).toBe('save-other');
    else expect(id).not.toBe('save-library');
    const saved = await saveCurrentGame(page, 'Identity verified');
    expect(saved.metadata.id).toBe(id);
    expectCanonical(saved, expected);
    const after = await fileSnapshot(page);
    expect({ ...after, [`saves/${id}/Identity verified.json`]: undefined }).toEqual({ ...before, [`saves/${id}/Identity verified.json`]: undefined });
    expect((await readSession(page)).openGameIds).toEqual(['save-library', id]);
    await reloadSaved(page, `saves/${id}/Identity verified.json`);
    await expect(page).toHaveURL(new RegExp('/game/' + id + '$'));
  });
}
