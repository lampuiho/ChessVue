import { test, expect } from './StorageTest';
import { playMove } from '../../support/BoardInteraction';
import { readFile, readGame, readSession } from '../../support/SaveInspection';
import { waitForJourney } from '../../support/JourneyBootstrap';
import { expectOperation, failNext, managedSnapshot, openStorageGame } from './StorageAction';
for (const phase of ['startup', 'navigation']) {
  test(`JRN-IO-08 keeps the workspace usable after ${phase} session checkpoint failure and persists a later route`, async ({ page }) => {
    if (phase === 'startup') {
      await page.goto('/?journey=storage-failures&variant=startup-session&reset=1');
      await waitForJourney(page);
    } else {
      await openStorageGame(page);
      await failNext(page, 'writeTextFile', 'game-session.json');
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
    }
    await expectOperation(page, 'writeTextFile', 'game-session.json', 'failed');
    await expect(page.getByRole('alert')).toContainText('Your session could not be saved');
    expect((await readSession(page)).activeRoute).toBe('/game/io-game');
    const before = await managedSnapshot(page);
    if (phase === 'navigation') {
      await page.getByRole('alert').getByRole('button', { name: 'Dismiss', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await playMove(page, 'f1', 'b5');
    await expect(page.locator('.history-row')).toHaveCount(5);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expectOperation(page, 'writeTextFile', 'game-session.json', 'succeeded');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(async () => (await readSession(page)).activeRoute).toBe('/saved-games/save/io-game');
    expect(await managedSnapshot(page)).toEqual(before);
    await page.reload();
    await waitForJourney(page);
    await expect(page).toHaveURL(/\/saved-games\/save\/io-game$/);
    expect((await readSession(page)).openGameIds).toEqual(['io-game', 'io-other']);
    const after = await managedSnapshot(page);
    expect({ ...after, 'saves/io-game/auto.json': before['saves/io-game/auto.json'] }).toEqual(before);
    expect((await readGame(page, 'saves/io-game/auto.json')).livePath).toHaveLength(5);
  });
}
for (const section of ['history', 'analysis']) {
  test(`JRN-IO-08 retains in-memory ${section} fold after failed layout checkpoint and reloads a later successful fold`, async ({ page }) => {
    await openStorageGame(page);
    const before = await readFile(page, 'layout-state.json');
    const games = await managedSnapshot(page);
    await failNext(page, 'writeTextFile', 'layout-state.json');
    await page.getByRole('button', { name: `Collapse ${section}`, exact: true }).click();
    await expectOperation(page, 'writeTextFile', 'layout-state.json', 'failed');
    await expect(page.locator('.toast')).toContainText('Try again');
    await expect(page.getByRole('button', { name: `Expand ${section}`, exact: true })).toBeVisible();
    expect(await readFile(page, 'layout-state.json')).toBe(before);
    await playMove(page, 'f1', 'b5');
    await page.getByRole('button', { name: `Expand ${section}`, exact: true }).click();
    await expectOperation(page, 'writeTextFile', 'layout-state.json', 'succeeded');
    await page.getByRole('button', { name: `Collapse ${section}`, exact: true }).click();
    await expect.poll(async () => JSON.parse((await readFile(page, 'layout-state.json'))!)[section + 'Collapsed']).toBe(true);
    expect(await managedSnapshot(page)).toEqual(games);
    await page.reload();
    await waitForJourney(page);
    await expect(page.getByRole('button', { name: `Expand ${section}`, exact: true })).toBeVisible();
    const after = await managedSnapshot(page);
    expect({ ...after, 'saves/io-game/auto.json': games['saves/io-game/auto.json'] }).toEqual(games);
    expect((await readGame(page, 'saves/io-game/auto.json')).livePath).toHaveLength(5);
  });
}
