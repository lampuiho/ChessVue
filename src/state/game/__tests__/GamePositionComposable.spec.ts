import { describe, expect, it } from 'vitest';

import { MoveNodeKind, PlayerColour } from '@/contracts';
import { appendChild, createGame, createMove } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';

describe('useGamePosition', () => {
  it('hydrates parent links and rebuilds the rendered and live node caches', () => {
    const game = createGame();
    const child = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    appendChild(child, createMove(PlayerColour.Black), MoveNodeKind.Live);
    game.livePath = [0, 0];
    game.renderedPath = [0];
    game.$ = undefined;
    const position = useGamePosition();

    position.hydrateGame(game);

    const renderedNode = position.getCurrentNode(game);
    const liveNode = position.getLiveNode(game);
    expect(position.getPathToNode(renderedNode)).toEqual([0]);
    expect(position.getPathToNode(liveNode)).toEqual([0, 0]);
    expect(renderedNode.$?.parent).toBe(game.moveTree.root);
    expect(liveNode.$?.parent).toBe(renderedNode);
    expect(renderedNode.$?.isHighlighted).toBe(true);
  });
  it('rejects nodes detached from the current hydrated tree', () => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame());
    const detachedGame = position.hydrateGame(createGame({ metadata: { ...game.metadata, id: 'detached' } }));

    expect(position.isNodeInTree(game.moveTree, position.getCurrentNode(game))).toBe(true);
    expect(position.isNodeInTree(game.moveTree, position.getCurrentNode(detachedGame))).toBe(false);
  });
});
