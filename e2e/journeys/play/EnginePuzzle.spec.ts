import { test, expect } from './PlayTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { choosePlayer } from './PlaySetup';

const line = ['f7h6', 'g8h8', 'e6g8', 'f8g8', 'h6f7'];
for (const engineColour of ['Black', 'White'] as const) {
  test(`JRN-PLAY-10 plays repeated engine turns through smothered mate with engine ${engineColour === 'Black' ? 'losing' : 'winning'}`, async ({ page }) => {
    await openJourney(page, 'play');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.evaluate(() => window.chessVueJourney.chooseImport('imports/smothered-mate.json'));
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(0);
    await choosePlayer(page, engineColour, 'Journey A');
    for (const [index, uci] of line.entries()) {
      const engineTurn = index % 2 === (engineColour === 'White' ? 0 : 1);
      if (!engineTurn) await playMove(page, uci.slice(0, 2), uci.slice(2));
      await expect(page.locator('.history-row')).toHaveCount(index + 1);
      await expect(square(page, uci.slice(2))).toHaveAttribute('aria-label', new RegExp(`${index % 2 === 0 ? 'white' : 'black'} `));
    }
    await expect(page.locator('.result-badge')).toHaveText('white won');
    await expect(page.locator('.history-row').last()).toContainText('Nf7#');
    await expect(page.getByRole('button', { name: /^(Resign|Offer draw|Pause|Analyse)$/ })).toHaveCount(0);
    const saved = await saveCurrentGame(page, 'engine-puzzle');
    expect(saved.resultState).toBe('whiteWon');
    expect(saved.resultReason).toBe('ruleResolved');
    expect(saved.livePath).toEqual([0, 0, 0, 0, 0]);
    expect(saved.clockSnapshot.white.isRunning).toBe(false);
    expect(saved.clockSnapshot.black.isRunning).toBe(false);
    await page.clock.runFor(2000);
    await expect(page.locator('.history-row')).toHaveCount(5);
    await page.reload();
    await waitForJourney(page);
    await expect(page.locator('.result-badge')).toHaveText('white won');
    await expect(page.locator('.history-row')).toHaveCount(5);
  });
}
