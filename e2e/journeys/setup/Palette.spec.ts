import { test, expect } from './SetupTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { expectFreeWorkspace } from './SetupAction';

for (const colour of ['white', 'black']) for (const kind of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
  test(`JRN-SETUP-03 adds, toggles, replaces, deletes and drags a ${colour} ${kind}`, async ({ page }) => {
    await openJourney(page, 'setup');
    await page.getByRole('button', { name: /Edit board/ }).click();
    const palette = page.locator('.piece-palette');
    await palette.getByRole('button', { name: `${colour} pieces`, exact: true }).click();
    await palette.getByRole('button', { name: kind, exact: true }).click();
    await square(page, 'a3').click();
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', `a3 ${colour} ${kind}`);
    await square(page, 'a3').click();
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', 'a3');
    await square(page, 'a3').click();
    const replacement = kind === 'queen' ? 'rook' : 'queen';
    await palette.getByRole('button', { name: replacement, exact: true }).click();
    await square(page, 'a3').click();
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', `a3 ${colour} ${replacement}`);
    await square(page, 'a3').click({ button: 'right' });
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', 'a3');
    await palette.getByRole('button', { name: kind, exact: true }).click();
    await square(page, 'a3').click();
    await square(page, 'a3').locator('.chess-piece').dragTo(square(page, 'b3'));
    await expect(square(page, 'a3')).toHaveAttribute('aria-label', 'a3');
    await expect(square(page, 'b3')).toHaveAttribute('aria-label', `b3 ${colour} ${kind}`);
    await expect(page.locator('.history-row')).toHaveCount(0);
    const saved = await saveCurrentGame(page, 'palette-edited');
    expectFreeWorkspace(saved);
    expect(saved.moveTree.root.children).toEqual([]);
    expect(saved.renderedPath).toEqual([]);
    expect(saved.rootPosition.board[17]).toEqual({ kind, colour });
    expect(saved.rootPosition.board[16]).toBeNull();
    expect(saved.rootPosition.board[27]).toEqual({ kind: 'pawn', colour: 'white' });
  });
}
