import { test, expect } from '../../support/TestEvidence';
import { getPosition } from '../../../journeys/builders/HistoryFixtureBuilder';
import { ruleColours, ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { readFile } from '../../support/SaveInspection';
import { expectCastledBoard, expectEnPassantBoard, expectSameGame, expectTargets, openRules, reloadRules } from './RuleAction';
for (const colour of ruleColours) for (const move of ['king', 'queen', 'en-passant'] as const) {
  test(`JRN-RULE-06 restores ${colour} ${move} before and after the special move with a legal continuation`, async ({ page }) => {
    const variant = `${move === 'en-passant' ? 'en-passant' : 'castle'}-${colour}`;
    await openRules(page, variant);
    const sq = (coordinate: string) => ruleSquare(coordinate, colour);
    const before = await saveCurrentGame(page, 'before');
    const path = `saves/rules-${variant}/before.json`;
    const bytes = await readFile(page, path);
    await reloadRules(page);
    expectSameGame(await saveCurrentGame(page, 'restored-before'), before);
    if (move === 'en-passant') await expectTargets(page, sq('e5'), ['e6', 'd6'].map(sq));
    else await expectTargets(page, sq('e1'), ['d1', 'd2', 'e2', 'f2', 'f1', 'g1', 'c1'].map(sq));
    await playMove(page, sq(move === 'en-passant' ? 'e5' : 'e1'), sq(move === 'en-passant' ? 'd6' : move === 'king' ? 'g1' : 'c1'));
    if (move === 'en-passant') await expectEnPassantBoard(page, colour);
    else await expectCastledBoard(page, colour, move);
    const saved = await saveCurrentGame(page, 'special');
    const specialPath = `saves/rules-${variant}/special.json`;
    const specialBytes = await readFile(page, specialPath);
    await reloadRules(page);
    if (move === 'en-passant') await expectEnPassantBoard(page, colour);
    else await expectCastledBoard(page, colour, move);
    const restored = await saveCurrentGame(page, 'restored-after');
    expectSameGame(restored, saved);
    expect(getPosition(restored, restored.livePath!)).toEqual(getPosition(saved, saved.livePath!));
    await playMove(page, sq(move === 'en-passant' ? 'h8' : 'e8'), sq(move === 'en-passant' ? 'g8' : 'e7'));
    await expect(page.locator('.history-row')).toHaveCount(move === 'en-passant' ? 3 : 2);
    await expect(page.locator('.result-badge')).toHaveText(`${colour} to move`);
    expect(await readFile(page, path)).toBe(bytes);
    expect(await readFile(page, specialPath)).toBe(specialBytes);
  });
}
