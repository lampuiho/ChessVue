import { test, expect } from './SetupTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { finishEditing, expectFreeWorkspace } from './SetupAction';

for (const selection of ['current', 'root']) {
  test(`JRN-SETUP-02 preserves ${selection} history until the first effective edit`, async ({ page }) => {
    await openJourney(page, 'setup');
    if (selection === 'root') await page.getByRole('button', { name: 'Start position', exact: true }).click();
    const before = await saveCurrentGame(page, 'before-edit');
    await page.getByRole('button', { name: /Edit board/ }).click();
    await square(page, 'a3').click({ button: 'right' });
    await finishEditing(page);
    const untouched = await saveCurrentGame(page, 'untouched');
    expect(untouched.moveTree).toEqual(before.moveTree);
    expect(untouched.renderedPath).toEqual(before.renderedPath);
    expect(untouched.rootPosition).toEqual(before.rootPosition);
    expect(untouched.gameState).toBe(before.gameState);
    await page.getByRole('button', { name: /Edit board/ }).click();
    await square(page, 'a3').click();
    await expect(page.locator('.history-row')).toHaveCount(0);
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', 'a3 white queen');
    const edited = await saveCurrentGame(page, 'edited');
    expectFreeWorkspace(edited);
    expect(edited.gameState).toBe('boardEdit');
    expect(edited.renderedPath).toEqual([]);
    expect(edited.moveTree.root.children).toEqual([]);
    expect(edited.rootPosition.sideToMove).toBe(selection === 'current' ? 'black' : 'white');
    expect(edited.rootPosition.board[27]).toEqual(selection === 'current' ? { kind: 'pawn', colour: 'white' } : null);
    await finishEditing(page);
    await expect(page.locator('.result-badge')).toHaveText(`${selection === 'current' ? 'black' : 'white'} to move`);
  });
}
