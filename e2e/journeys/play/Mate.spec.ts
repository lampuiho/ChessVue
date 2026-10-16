import { test, expect } from './PlayTest';
import type { Page } from '@playwright/test';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { selectGame } from '../../support/GameNavigation';
import { saveCurrentGame } from '../../support/GameSave';
import { createTimedPlay, expectStoppedClock } from './PlaySetup';

async function prepareMate(page: Page, mode: string): Promise<void> {
  await openJourney(page, 'play');
  if (mode === 'seeded') await selectGame(page, 'play-mate', 'One move to checkmate');
  else {
    await createTimedPlay(page);
    await playMove(page, 'f2', 'f3');
    await playMove(page, 'e7', 'e5');
    await playMove(page, 'g2', 'g4');
  }
}
for (const mode of ['seeded', 'timed']) {
  test(`JRN-PLAY-03 @smoke records ${mode} checkmate and preserves it through review and reload`, async ({ page }) => {
    await prepareMate(page, mode);
    await playMove(page, 'd8', 'h4');
    await expect(page.locator('.result-badge')).toHaveText('black won');
    await expect(page.locator('.history-row--selected')).toContainText('Qh4#');
    await expect(square(page, 'h4')).toHaveAttribute('aria-label', 'h4 black queen');
    await expect(page.getByRole('button', { name: /^(Resign|Offer draw|Pause|Analyse)$/ })).toHaveCount(0);
    await playMove(page, 'e2', 'e4');
    await expect(page.locator('.history-row')).toHaveCount(4);
    const saved = await saveCurrentGame(page, 'mate');
    expect(saved.resultReason).toBe('ruleResolved');
    expect(saved.moveTree.root.children[0]!.children[0]!.children[0]!.children[0]!.move?.checkState).toBe('checkmate');
    expect(saved.clockSnapshot.white.isRunning).toBe(false);
    expect(saved.clockSnapshot.black.isRunning).toBe(false);
    if (mode === 'timed') await expectStoppedClock(page);
    await page.reload();
    await waitForJourney(page);
    await expect(page.locator('.result-badge')).toHaveText('black won');
    await expect(page.locator('.history-row').last()).toContainText('Qh4#');
    await page.locator('.history-row').first().click();
    await playMove(page, 'd7', 'd5');
    await expect(page.locator('.result-badge')).toHaveText('black won');
    const explored = await saveCurrentGame(page, 'mate-reviewed');
    expect(explored.livePath).toEqual(saved.livePath);
    expect(explored.resultState).toBe('blackWon');
    expect(explored.resultReason).toBe('ruleResolved');
  });
}
