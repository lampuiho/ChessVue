import { expect, type Page } from '@playwright/test';
import { workspaceKinds } from '../../../journeys/definitions/saves/data/WorkspaceSnapshot';
import { playMove, square } from '../../support/BoardInteraction';
export async function exerciseWorkspace(page: Page, kind: typeof workspaceKinds[number], plies: number) {
  if (kind === 'edit') {
    await expect(page.locator('.piece-palette')).toBeVisible();
    await expect(square(page, 'a2')).toHaveAttribute('aria-label', 'a2');
    await square(page, 'b2').click({ button: 'right' });
    await expect(square(page, 'b2')).toHaveAttribute('aria-label', 'b2');
  } else if (kind === 'nested') {
    await expect(page.locator('.history-row--selected')).toContainText('Nc3');
    await expect(square(page, 'c3')).toHaveAttribute('aria-label', 'c3 white knight');
    await page.getByRole('button', { name: 'Live position', exact: true }).click();
    await expect(square(page, 'c6')).toHaveAttribute('aria-label', 'c6 black knight');
  } else if (kind === 'promotion' || kind === 'finished') {
    if (kind === 'promotion') await expect(square(page, 'a8')).toHaveAttribute('aria-label', 'a8 white rook');
    else await expect(page.locator('.result-badge')).toHaveText('black won');
    await page.getByRole('button', { name: /Takeback/ }).click();
    await expect(page.locator('.history-row')).toHaveCount(plies - 1);
  } else {
    if (kind === 'timed') await page.getByRole('button', { name: /^Resume game/ }).click();
    await playMove(page, 'g1', 'f3');
    await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
  }
}
