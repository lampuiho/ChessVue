import { test, expect } from './RaceTest';
import { emit, heldPlayer, latestSearch, openRace, playerSearchCount, release } from './RaceAction';
import { playMove, square } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
test.setTimeout(60000);
for (const orientation of ['white', 'black'] as const) for (const gesture of ['click', 'drag'] as const) {
  test(`queues every piece in one sequence using ${gesture} with ${orientation} orientation`, async ({ page }) => {
    await openRace(page);
    if (orientation === 'black') {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Appearance', exact: true }).click();
      await page.getByLabel('Orientation', { exact: true }).selectOption('black');
      await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
      await page.getByRole('button', { name: 'Back to game', exact: true }).click();
    }
    const first = await heldPlayer(page);
    const moves = [['d2', 'd4', 'pawn'], ['c1', 'f4', 'bishop'], ['d1', 'd2', 'queen'],
      ['e1', 'd1', 'king'], ['b1', 'c3', 'knight'], ['a1', 'b1', 'rook']] as const;
    for (const [from, to, kind] of moves) {
      if (gesture === 'drag') await square(page, from).locator('.chess-piece').dragTo(square(page, to));
      else await playMove(page, from, to);
      await expect(square(page, from)).toHaveAttribute('aria-label', from);
      await expect(square(page, to)).toHaveAttribute('aria-label', `${to} white ${kind}`);
      await expect(square(page, to)).toHaveClass(/board-square--premove/);
      await expect(page.locator('.history-row')).toHaveCount(1);
    }
    let search = first;
    const replies = ['e7e5', 'b8c6', 'g8f6', 'd7d6', 'c8e6', 'f8e7'];
    for (let index = 0; index < moves.length; index += 1) {
      await emit(page, search.id, `bestmove ${replies[index]}`);
      await expect(page.locator('.history-row')).toHaveCount(3 + index * 2);
      search = await latestSearch(page, 'player', 'journey://a', search.id);
    }
    await expect(page.locator('.board-square--premove')).toHaveCount(0);
    for (const [, to, kind] of moves) await expect(square(page, to)).toHaveAttribute('aria-label', `${to} white ${kind}`);
    expect(await playerSearchCount(page)).toBe(7);
  });
}
for (const orientation of ['white', 'black'] as const) {
  test(`JRN-RACE-09 PRE-S01 PRE-S02 PRE-S03 projects, consumes and cancels a chain with ${orientation} orientation`, async ({ page }) => {
    await openRace(page);
    if (orientation === 'black') {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Appearance', exact: true }).click();
      await page.getByLabel('Orientation', { exact: true }).selectOption('black');
      await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
      await page.getByRole('button', { name: 'Back to game', exact: true }).click();
    }
    const first = await heldPlayer(page);
    await playMove(page, 'g1', 'f3');
    await playMove(page, 'f3', 'g5');
    await expect(square(page, 'g5')).toHaveAttribute('aria-label', 'g5 white knight');
    await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1');
    await expect(page.locator('.board-square--premove')).toHaveCount(3);
    const preview = await saveCurrentGame(page, 'premove-preview');
    expect(preview.livePath).toEqual([0]);
    expect(preview.rootPosition.board[6]?.kind).toBe('knight');
    expect(JSON.stringify(preview)).not.toContain('premoveQueue');
    await release(page, first.id);
    await expect(page.locator('.history-row')).toHaveCount(3);
    await expect(page.locator('.board-square--premove')).toHaveCount(2);
    await square(page, 'a3').click({ button: 'right' });
    await expect(page.locator('.board-square--premove')).toHaveCount(0);
    await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
    expect(await playerSearchCount(page)).toBe(2);
  });
}
for (const mode of ['analysis', 'review'] as const) {
  test(`JRN-RACE-09 PRE-S08 PRE-S11 drains successive actual turns behind ${mode}`, async ({ page }) => {
    await openRace(page);
    const first = await heldPlayer(page);
    await playMove(page, 'g1', 'f3');
    await playMove(page, 'f3', 'g5');
    if (mode === 'analysis') await page.getByRole('button', { name: /^Analyse/ }).click();
    else await page.getByRole('button', { name: 'Start position', exact: true }).click();
    await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1 white knight');
    await expect(page.locator('.board-square--premove')).toHaveCount(0);
    await release(page, first.id);
    const second = await latestSearch(page, 'player', 'journey://a', first.id);
    await release(page, second.id);
    await latestSearch(page, 'player', 'journey://a', second.id);
    await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1 white knight');
    if (mode === 'analysis') await page.getByRole('button', { name: /^Exit analysis/ }).click();
    else await page.getByRole('button', { name: 'Live position', exact: true }).click();
    await expect(square(page, 'g5')).toHaveAttribute('aria-label', 'g5 white knight');
    const actual = await saveCurrentGame(page, 'premove-background');
    expect(actual.livePath).toHaveLength(5);
    expect(actual.renderedPath).toEqual(actual.livePath);
    expect(actual.clockSnapshot.white.remainingMs).toBe(64000);
    expect(actual.clockSnapshot.black.remainingMs).toBe(64000);
    expect(await playerSearchCount(page)).toBe(3);
  });
}
test('JRN-RACE-09 PRE-S10 holds a queue and reply during a genuine pause, then drains once', async ({ page }) => {
  await openRace(page);
  const search = await heldPlayer(page);
  await playMove(page, 'g1', 'f3');
  await page.getByRole('button', { name: /^Pause/ }).click();
  await release(page, search.id);
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.board-square--premove')).toHaveCount(2);
  await page.getByRole('button', { name: /^Resume game/ }).click();
  await expect(page.locator('.history-row')).toHaveCount(3);
  await expect(page.locator('.board-square--premove')).toHaveCount(0);
  await expect(square(page, 'f3')).toHaveAttribute('aria-label', 'f3 white knight');
  expect(await playerSearchCount(page)).toBe(2);
});
test('JRN-RACE-09 PRE-S03 touch cancellation restores canonical pieces without playing a move', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRace(page);
  await heldPlayer(page);
  await playMove(page, 'g1', 'f3');
  await playMove(page, 'f3', 'g5');
  const point = await square(page, 'g5').boundingBox();
  const session = await page.context().newCDPSession(page);
  const touchPoints = [{ x: point!.x + point!.width / 2, y: point!.y + point!.height / 2 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.board-square--premove')).toHaveCount(0);
  await expect(square(page, 'g1')).toHaveAttribute('aria-label', 'g1 white knight');
  await expect(page.locator('.history-row')).toHaveCount(1);
});
