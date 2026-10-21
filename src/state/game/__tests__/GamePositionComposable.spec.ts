import { describe, expect, it } from 'vitest';

import { GameState, MoveNodeKind, PlayerColour } from '@/contracts';
import { appendChild, createGame, createMove } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';

describe('useGamePosition', () => {
  it.each(['rendered', 'live'])('preserves independent equal-path analysis caches when reading %s first', (first) => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame());
    const live = position.getLivePosition(game);
    const selected = structuredClone(live);
    position.setRenderedPath(game, [...game.renderedPath], { node: game.moveTree.root, position: selected });
    if (first === 'rendered') expect(position.getRenderedPosition(game)).toBe(selected);
    else expect(position.getLivePosition(game)).toBe(live);
    expect(position.getRenderedPosition(game)).toBe(selected);
    expect(position.getLivePosition(game)).toBe(live);
    expect(selected).not.toBe(live);
  });
  it('does not re-alias an explicitly analysed equal-path selection during hydration', () => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame({ gameState: GameState.LiveAnalysisFromWhiteTurnWhiteMove }));
    expect(game.renderedPath).toEqual(game.livePath);
    expect(game.renderedPath).not.toBe(game.livePath);
    expect(position.getRenderedPosition(game)).not.toBe(position.getLivePosition(game));
  });
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
  it('aliases matching restored selectors and their lazily resolved caches', () => {
    const game = createGame();
    const child = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    game.livePath = [0];
    game.renderedPath = [0];
    game.$ = undefined;
    const position = useGamePosition();

    position.hydrateGame(game);

    const runtime = position.requireGameRuntime(game);
    expect(game.renderedPath).toBe(game.livePath);
    expect(position.getRenderedNode(game)).toBe(child);
    expect(position.getLiveNode(game)).toBe(child);
    expect(runtime.renderedNode).toBe(runtime.liveNode);
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
  it('sets selector references exactly as supplied', () => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame());
    const renderedPath: number[] = [];
    const livePath: number[] = [];

    position.setRenderedPath(game, renderedPath);
    position.setLivePath(game, livePath);

    expect(game.renderedPath).toBe(renderedPath);
    expect(game.livePath).toBe(livePath);
    expect(game.renderedPath).not.toBe(game.livePath);
  });
  it('appends selectors in place and advances their corresponding node caches', () => {
    const game = createGame();
    const renderedChild = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Analysis);
    const liveChild = appendChild(game.moveTree.root, createMove(PlayerColour.Black), MoveNodeKind.Live);
    const position = useGamePosition();
    position.hydrateGame(game);
    const renderedPath: number[] = [];
    const livePath: number[] = [];
    position.setRenderedPath(game, renderedPath, { node: game.moveTree.root });
    position.setLivePath(game, livePath, { node: game.moveTree.root });

    position.appendRenderedPath(game, renderedChild);
    position.appendLivePath(game, liveChild);

    expect(game.renderedPath).toBe(renderedPath);
    expect(game.renderedPath).toEqual([0]);
    expect(game.livePath).toBe(livePath);
    expect(game.livePath).toEqual([1]);
    expect(game.$?.renderedNode).toBe(renderedChild);
    expect(game.$?.liveNode).toBe(liveChild);
  });
  it('advances shared rendered and live selectors through one live append', () => {
    const position = useGamePosition();
    const game = position.hydrateGame(createGame());
    const sharedPath = game.livePath!;
    const liveChild = appendChild(game.moveTree.root, createMove(), MoveNodeKind.Live);
    position.getLiveNode(game);

    position.appendLivePath(game, liveChild);

    expect(game.livePath).toBe(sharedPath);
    expect(game.renderedPath).toBe(sharedPath);
    expect(sharedPath).toEqual([0]);
    expect(game.$?.liveNode).toBe(liveChild);
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
