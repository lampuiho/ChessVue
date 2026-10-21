import { test, expect } from '../../support/TestEvidence';
import { MoveKind } from '../../../src/contracts';
import { getPosition } from '../../../journeys/builders/HistoryFixtureBuilder';
import { castleSides, ruleColours, ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { expectCastledBoard, expectPiece, expectSameGame, expectTargets, openRules } from './RuleAction';
for (const colour of ruleColours) for (const side of castleSides) {
  test(`JRN-RULE-01 @smoke castles ${colour} ${side} side and takes back both pieces and rights`, async ({ page }) => {
    await openRules(page, `castle-${colour}`);
    const _sq = (coordinate: string) => ruleSquare(coordinate, colour);
    const before = await saveCurrentGame(page, 'before');
    await expectTargets(page, _sq('e1'), ['d1', 'd2', 'e2', 'f2', 'f1', 'g1', 'c1'].map(_sq));
    await playMove(page, _sq('e1'), _sq(side === 'king' ? 'g1' : 'c1'));
    await expectCastledBoard(page, colour, side);
    const saved = await saveCurrentGame(page, 'castled');
    expect(saved.moveTree.root.children[0]!.move).toMatchObject({ kind: MoveKind.Castle, movingColour: colour, movingPiece: 'king' });
    expect(saved.livePath).toEqual([0]);
    expect(saved.renderedPath).toEqual([0]);
    expect(getPosition(saved, saved.livePath!).castlingAvailability).toEqual({
      whiteKingSide: colour !== 'white', whiteQueenSide: colour !== 'white', blackKingSide: colour !== 'black', blackQueenSide: colour !== 'black',
    });
    await page.getByRole('button', { name: /Takeback/ }).click();
    await expectPiece(page, _sq('e1'), `${colour} king`);
    await expectPiece(page, _sq('a1'), `${colour} rook`);
    await expectPiece(page, _sq('h1'), `${colour} rook`);
    await expect(page.locator('.history-row')).toHaveCount(0);
    expectSameGame(await saveCurrentGame(page, 'rewound'), before);
    await playMove(page, _sq('e1'), _sq(side === 'king' ? 'g1' : 'c1'));
    await expectCastledBoard(page, colour, side);
  });
}
