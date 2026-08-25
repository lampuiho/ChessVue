import { describe, expect, it } from 'vitest';

import { MoveNodeKind, PlayerColour } from '@/contracts';
import { appendChild, createGame, createMove } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';

describe('useGamePosition', () => {
  it('hydrates parent links and resolves rendered and live selections lazily', () => {
    const game = createGame();
    const child = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    appendChild(child, createMove(PlayerColour.Black), MoveNodeKind.Live);
    game.livePath = [0, 0];
    game.renderedPath = [0];
    game.$ = undefined;
    const root = game.moveTree.root;
    const position = useGamePosition();

    position.hydrateGame(game);

    const runtime = position.requireGameRuntime(game);
    expect(runtime.renderedNode).toBeUndefined();
    expect(runtime.liveNode).toBeUndefined();
    const renderedNode = position.getRenderedNode(game);
    const liveNode = position.getLiveNode(game);
    expect(game.moveTree.root).toBe(root);
    expect(renderedNode).toBe(child);
    expect(position.getPathToNode(renderedNode)).toEqual([0]);
    expect(position.getPathToNode(liveNode)).toEqual([0, 0]);
    expect(renderedNode.$?.parent).toBe(game.moveTree.root);
    expect(liveNode.$?.parent).toBe(renderedNode);
    expect(runtime.renderedNode).toBe(renderedNode);
    expect(runtime.liveNode).toBe(liveNode);
  });
  it('rejects nodes detached from the current hydrated tree', () => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame());
    const detachedGame = position.hydrateGame(createGame({ metadata: { ...game.metadata, id: 'detached' } }));

    expect(position.isNodeInTree(game.moveTree, position.getRenderedNode(game))).toBe(true);
    expect(position.isNodeInTree(game.moveTree, position.getRenderedNode(detachedGame))).toBe(false);
  });
  it('preserves unrelated runtime state and invalidates only the changed selection', () => {
    const game = createGame();
    const child = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    game.livePath = [0];
    game.renderedPath = [0];
    const position = useGamePosition();
    position.hydrateGame(game);
    position.getRenderedNode(game);
    position.getLiveNode(game);
    const runtime = game.$!;
    const liveNode = runtime.liveNode;

    position.setRenderedPath(game, [], { node: game.moveTree.root });

    expect(game.$).toBe(runtime);
    expect(runtime.liveNode).toBe(liveNode);
    expect(position.getRenderedNode(game)).toBe(game.moveTree.root);
    expect(position.getLiveNode(game)).toBe(child);
  });
  it('invalidates rendered caches on path changes and both caches on tree replacement', () => {
    const game = createGame();
    appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    game.renderedPath = [0];
    const position = useGamePosition();
    position.hydrateGame(game);
    const cachedChild = position.getRenderedNode(game);

    position.setRenderedPath(game, []);
    expect(game.$?.renderedNode).toBeUndefined();
    expect(position.getRenderedNode(game)).toBe(game.moveTree.root);
    expect(position.getRenderedNode(game)).not.toBe(cachedChild);
    const replacementTree = createGame().moveTree;
    position.replaceMoveTree(game, replacementTree);
    expect(game.$?.renderedNode).toBeUndefined();
    expect(game.$?.liveNode).toBeUndefined();
  });
  it('invalidates a derived rendered position without changing its path or node', () => {
    const game = createGame();
    game.livePath = undefined;
    const position = useGamePosition();
    position.hydrateGame(game);
    const renderedNode = position.getRenderedNode(game);
    const renderedPosition = position.getRenderedPosition(game);
    const renderedPath = game.renderedPath;

    position.invalidateRenderedPosition(game);

    expect(game.renderedPath).toBe(renderedPath);
    expect(game.$?.renderedNode).toBe(renderedNode);
    expect(game.$?.renderedPosition).toBeUndefined();
    expect(position.getRenderedPosition(game)).not.toBe(renderedPosition);
  });
});
