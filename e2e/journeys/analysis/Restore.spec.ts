import { test, expect } from './AnalysisTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { square } from '../../support/BoardInteraction';
import { analysisSeat, expectOutput, setResumeAfterRestore } from './AnalysisAction';
for (const resume of [true, false]) for (const editing of [false, true]) {
  test(`JRN-ANALYSIS-11 restores assignments with resume ${resume ? 'on' : 'off'} in ${editing ? 'board edit' : 'analysis'}`, async ({ page }) => {
    await openJourney(page, 'analysis');
    await expectOutput(page);
    await setResumeAfterRestore(page, resume);
    if (editing) {
      await page.getByRole('button', { name: /Edit board/ }).click();
      await square(page, 'h2').click({ button: 'right' });
      await expect(page.locator('.analysis-line')).toHaveCount(0);
    }
    const before = await saveCurrentGame(page, 'restore-analysis');
    await page.reload();
    await waitForJourney(page);
    for (const name of ['Journey A', 'Journey B']) await expect(analysisSeat(page, name)).toHaveCount(1);
    if (resume && !editing) await expectOutput(page);
    else {
      await page.clock.runFor(1000);
      await expect(page.getByRole('button', { name: 'Stop engine', exact: true })).toHaveCount(0);
      if (editing) await expect(page.getByRole('button', { name: 'Refresh analysis', exact: true })).toBeDisabled();
      else await expect(page.getByRole('button', { name: 'Refresh analysis', exact: true })).toBeEnabled();
      if (editing) await expect(page.locator('.analysis-line')).toHaveCount(0);
    }
    const restored = await saveCurrentGame(page, 'restored-analysis');
    expect(restored.analysis.seats.map((seat) => seat.assignedEngine)).toEqual(before.analysis.seats.map((seat) => seat.assignedEngine));
    expect(restored.moveTree).toEqual(before.moveTree);
    expect(restored.rootPosition).toEqual(before.rootPosition);
    expect(restored.gameState).toBe(before.gameState);
    expect(restored.renderedPath).toEqual(before.renderedPath);
    if (editing) await page.getByRole('button', { name: /Finish editing/ }).click();
    else if (!resume) await page.getByRole('button', { name: 'Refresh analysis', exact: true }).click();
    await expectOutput(page);
  });
}
