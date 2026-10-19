import { test, expect } from '../../support/TestEvidence';
import { MoveKind } from '../../../src/contracts';
import { getPosition } from '../../../journeys/builders/HistoryFixtureBuilder';
import { ruleBoardId, ruleColours, ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { expectEnPassantBoard, expectPiece, expectSameGame, expectTargets, openRules, rejectMove } from './RuleAction';
for (const colour of ruleColours) {
  test(`JRN-RULE-03 captures en passant immediately as ${colour} and restores the opportunity on takeback`, async ({ page }) => {
    await openRules(page, `en-passant-${colour}`);
    const sq = (coordinate: string) => ruleSquare(coordinate, colour);
    const before = await saveCurrentGame(page, 'before');
    expect(getPosition(before, before.livePath!).enPassantTarget).toBe(ruleBoardId(sq('d6')));
    await expectTargets(page, sq('e5'), ['e6', 'd6'].map(sq));
    await playMove(page, sq('e5'), sq('d6'));
    await expectEnPassantBoard(page, colour);
    const saved = await saveCurrentGame(page, 'captured');
    expect(saved.moveTree.root.children[0]!.children[0]!.move).toMatchObject({ kind: MoveKind.EnPassant, movingPiece: 'pawn', movingColour: colour, capturePiece: 'pawn' });
    expect(getPosition(saved, saved.livePath!).enPassantTarget).toBeUndefined();
    await page.getByRole('button', { name: /Takeback/ }).click();
    await expectPiece(page, sq('e5'), `${colour} pawn`);
    await expectPiece(page, sq('d5'), `${colour === 'white' ? 'black' : 'white'} pawn`);
    await expect(page.getByLabel('Captured material')).toHaveCount(0);
    expectSameGame(await saveCurrentGame(page, 'rewound'), before);
    await expectTargets(page, sq('e5'), ['e6', 'd6'].map(sq));
  });
  test(`JRN-RULE-03 expires ${colour} en passant after an intervening move`, async ({ page }) => {
    await openRules(page, `en-passant-${colour}`);
    const sq = (coordinate: string) => ruleSquare(coordinate, colour);
    await playMove(page, sq('a1'), sq('b1'));
    await playMove(page, sq('h8'), sq('g8'));
    await expect(page.locator('.history-row')).toHaveCount(3);
    await expectTargets(page, sq('e5'), [sq('e6')]);
    await rejectMove(page, sq('e5'), sq('d6'));
    const saved = await saveCurrentGame(page, 'expired');
    expect(getPosition(saved, saved.livePath!).enPassantTarget).toBeUndefined();
    await expectPiece(page, sq('d5'), `${colour === 'white' ? 'black' : 'white'} pawn`);
    await playMove(page, sq('e5'), sq('e6'));
    await expect(page.locator('.history-row')).toHaveCount(4);
  });
}
