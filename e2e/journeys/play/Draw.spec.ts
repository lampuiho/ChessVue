import { test, expect } from './PlayTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { choosePlayer, createTimedPlay, expectStoppedClock } from './PlaySetup';

for (const outcome of ['Cancel', 'Decline', 'Accept']) {
  test(`JRN-PLAY-05 resolves a local draw using ${outcome}`, async ({ page }) => {
    await openJourney(page, 'play');
    await createTimedPlay(page);
    await page.getByRole('button', { name: 'Offer draw', exact: true }).click();
    const offer = page.getByRole('dialog', { name: 'Offer a draw?', exact: true });
    if (outcome === 'Cancel') await offer.getByRole('button', { name: 'Cancel', exact: true }).click();
    else {
      await offer.getByRole('button', { name: 'Offer draw', exact: true }).click();
      const response = page.getByRole('dialog', { name: 'Draw offered', exact: true });
      await expect(response).toContainText('black to respond');
      await page.keyboard.press('Escape');
      await expect(response).toBeVisible();
      await response.getByRole('button', { name: outcome, exact: true }).click();
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const saved = await saveCurrentGame(page, 'draw-' + outcome.toLowerCase());
    expect(saved.drawOfferState).toBeUndefined();
    expect(saved.livePath).toEqual([]);
    if (outcome === 'Accept') {
      await expect(page.locator('.result-badge')).toHaveText('drawn');
      expect(saved.resultState).toBe('drawn');
      expect(saved.resultReason).toBe('drawAgreement');
      expect(saved.clockSnapshot.white.isRunning).toBe(false);
      expect(saved.clockSnapshot.black.isRunning).toBe(false);
      await expect(page.getByRole('button', { name: /^(Resign|Offer draw)$/ })).toHaveCount(0);
      await expectStoppedClock(page);
    } else {
      expect(saved.resultState).toBe('ongoing');
      await playMove(page, 'e2', 'e4');
      await expect(page.locator('.history-row')).toHaveCount(1);
    }
  });
}
test('JRN-PLAY-06 keeps an engine draw pending until withdrawal without inventing a response', async ({ page }) => {
  await openJourney(page, 'play');
  await createTimedPlay(page);
  await choosePlayer(page, 'Black', 'Journey A');
  await page.getByRole('button', { name: 'Offer draw', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const resolve = page.getByRole('button', { name: 'Resolve draw', exact: true });
  await expect(resolve.locator('i.active')).toBeVisible();
  const offered = await saveCurrentGame(page, 'engine-offer');
  expect(offered.resultState).toBe('ongoing');
  expect(offered.drawOfferState).toEqual({ offeringColour: 'white', respondingColour: 'black', direction: 'outgoing' });
  await resolve.click();
  await expect(page.getByRole('button', { name: 'Offer draw', exact: true })).toBeVisible();
  const withdrawn = await saveCurrentGame(page, 'withdrawn');
  expect(withdrawn.drawOfferState).toBeUndefined();
  expect(withdrawn.resultState).toBe('ongoing');
  await playMove(page, 'e2', 'e4');
  await expect(page.locator('.history-row')).toHaveCount(2);
});
