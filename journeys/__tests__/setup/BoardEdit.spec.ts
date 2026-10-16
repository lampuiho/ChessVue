import { describe, expect, it } from 'vitest';
import { GameState, PieceKind, PlayerColour, type IGame } from '@/contracts';
import { boot } from '../support/UiHarness';

describe('JRN-SETUP-02 first effective edit', () => {
  for (const selection of ['current', 'root']) {
    it(`preserves ${selection} history on empty deletion and same-square or empty-source dragging`, async () => {
      const { games, domain } = await boot('setup');
      const game = games.getGame('setup-analysis') as unknown as IGame;
      if (selection === 'root') games.navigateToNode(game, game.moveTree.root);
      const before = domain.SerializationService.serialiseGame(game);
      games.enterBoardEdit(game);
      games.deleteChessPiece(game, 16);
      const occupied = selection === 'current' ? 27 : 11;
      games.moveChessPiece(game, occupied, occupied);
      games.moveChessPiece(game, 16, 17);
      games.enterBoardEdit(game);
      const after = JSON.parse(domain.SerializationService.serialiseGame(game));
      expect({ ...after, metadata: JSON.parse(before).metadata }).toEqual(JSON.parse(before));
    });
    it(`discards the entire tree when editing the ${selection} position and keeps one root on later edits`, async () => {
      const { games, domain, fixtures } = await boot('setup');
      const game = games.getGame('setup-analysis') as unknown as IGame;
      if (selection === 'root') games.navigateToNode(game, game.moveTree.root);
      const expected = JSON.parse(JSON.stringify(fixtures.getPosition(game, game.renderedPath)));
      games.enterBoardEdit(game);
      games.toggleChessPiece(game, 16, { kind: PieceKind.Queen, colour: PlayerColour.White });
      const root = game.moveTree.root;
      expect(root.children).toEqual([]);
      expect(game.renderedPath).toEqual([]);
      expect(game.rootPosition.sideToMove).toBe(expected.sideToMove);
      expected.board[16] = { kind: PieceKind.Queen, colour: PlayerColour.White };
      const edited = JSON.parse(domain.SerializationService.serialiseGame(game));
      expect(edited.rootPosition).toEqual(expected);
      games.moveChessPiece(game, 16, 17);
      games.deleteChessPiece(game, 17);
      expect(game.moveTree.root).toBe(root);
      expect(root.children).toEqual([]);
      expect(game.livePath).toBeUndefined();
      expect(game.gameState).toBe(GameState.BoardEdit);
    });
  }
});
