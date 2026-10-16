import { test, expect } from './PlayTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { createTimedPlay, expectStoppedClock } from './PlaySetup';

test('JRN-PLAY-04 cancels resignation without changing the game', async ({ page }) => {
  await openJourney(page, 'play');
  await createTimedPlay(page);
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Resign this game?', exact: true });
  await expect(dialog).toContainText('white resigns');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const saved = await saveCurrentGame(page, 'cancel-resign');
  expect(saved.resultState).toBe('ongoing');
  expect(saved.resultReason).toBeUndefined();
  expect(saved.livePath).toEqual([]);
  await playMove(page, 'e2', 'e4');
  await expect(page.locator('.history-row')).toHaveCount(1);
});
for (const colour of ['white', 'black']) {
  test(`JRN-PLAY-04 confirms ${colour} resignation once and keeps review usable`, async ({ page }) => {
    await openJourney(page, 'play');
    await createTimedPlay(page);
    await playMove(page, 'e2', 'e4');
    if (colour === 'white') await playMove(page, 'e7', 'e5');
    await page.getByRole('button', { name: 'Resign', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Resign this game?', exact: true });
    await expect(dialog).toContainText(`${colour} resigns`);
    await dialog.getByRole('button', { name: 'Resign', exact: true }).dblclick();
    const winner = colour === 'white' ? 'black' : 'white';
    await expect(page.locator('.result-badge')).toHaveText(`${winner} won`);
    await expect(page.getByRole('button', { name: /^(Resign|Offer draw)$/ })).toHaveCount(0);
    const saved = await saveCurrentGame(page, 'resigned');
    expect(saved.resultState).toBe(`${winner}Won`);
    expect(saved.resultReason).toBe('resignation');
    expect(saved.clockSnapshot.white.isRunning).toBe(false);
    expect(saved.clockSnapshot.black.isRunning).toBe(false);
    await expectStoppedClock(page);
    await page.locator('.history-row').first().click();
    await expect(square(page, 'e4')).toHaveAttribute('aria-label', 'e4 white pawn');
    await expect(page.locator('.result-badge')).toHaveText(`${winner} won`);
  });
}
