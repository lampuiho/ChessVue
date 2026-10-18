import { test, expect } from './SaveTest';
import { playMove } from '../../support/BoardInteraction';
import { readFile, readGame, managedFiles } from '../../support/SaveInspection';
import { openLibraryGame, setAutosaveInterval } from './SaveAction';
import { waitForJourney } from '../../support/JourneyBootstrap';
for (const interval of [3, 0]) {
  test(`JRN-SAVE-06 autosaves at three and six committed plies with interval ${interval}`, async ({ page }) => {
    await openLibraryGame(page);
    await setAutosaveInterval(page, interval);
    const path = 'saves/save-library/auto.json';
    const original = await readFile(page, path);
    const opening = await readFile(page, 'saves/save-library/Opening.json');
    const later = await readFile(page, 'saves/save-library/Middlegame.json');
    await playMove(page, 'f1', 'b5');
    await playMove(page, 'a7', 'a6');
    expect(await readFile(page, path)).toBe(original);
    await playMove(page, 'b5', 'a4');
    if (interval) await expect.poll(async () => (await readGame(page, path)).renderedPath.length).toBe(7);
    else expect(await readFile(page, path)).toBe(original);
    const first = await readFile(page, path);
    await playMove(page, 'g8', 'f6');
    await playMove(page, 'd2', 'd3');
    expect(await readFile(page, path)).toBe(first);
    await playMove(page, 'f8', 'e7');
    if (interval) await expect.poll(async () => (await readGame(page, path)).renderedPath.length).toBe(10);
    else expect(await readFile(page, path)).toBe(original);
    expect(await readFile(page, 'saves/save-library/Opening.json')).toBe(opening);
    expect(await readFile(page, 'saves/save-library/Middlegame.json')).toBe(later);
    expect((await managedFiles(page)).filter((file) => file === path)).toHaveLength(1);
    if (interval) {
      await page.reload();
      await waitForJourney(page);
      await expect(page.locator('.history-row')).toHaveCount(10);
    }
  });
}
