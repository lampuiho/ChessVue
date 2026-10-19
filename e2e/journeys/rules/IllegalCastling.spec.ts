import { test, expect } from '../../support/TestEvidence';
import { getPosition } from '../../../journeys/builders/HistoryFixtureBuilder';
import { castleObstacles, castleSides, ruleColours, ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { playMove } from '../../support/BoardInteraction';
import { saveCurrentGame } from '../../support/GameSave';
import { openRules, rejectMove } from './RuleAction';
for (const colour of ruleColours) for (const side of castleSides) for (const obstacle of castleObstacles) {
  test(`JRN-RULE-02 rejects ${colour} ${side} side castling with ${obstacle} without mutation`, async ({ page }) => {
    await openRules(page, `castle-${colour}-${side}-${obstacle}`);
    const sq = (coordinate: string) => ruleSquare(coordinate, colour);
    await rejectMove(page, sq('e1'), sq(side === 'king' ? 'g1' : 'c1'));
    if (obstacle === 'king-moved' || obstacle === 'rook-moved') {
      const saved = await saveCurrentGame(page, 'rights');
      const rights = getPosition(saved, saved.livePath!).castlingAvailability;
      const ownRights = colour === 'white' ? [rights.whiteKingSide, rights.whiteQueenSide] : [rights.blackKingSide, rights.blackQueenSide];
      expect(ownRights).toEqual(obstacle === 'king-moved' ? [false, false] : side === 'king' ? [false, true] : [true, false]);
    }
    await playMove(page, sq('e1'), sq('f2'));
    await expect(page.locator('.result-badge')).toHaveText(`${colour === 'white' ? 'black' : 'white'} to move`);
  });
}
