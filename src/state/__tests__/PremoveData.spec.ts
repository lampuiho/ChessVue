import { describe, expect, expectTypeOf, it } from 'vitest';
import { GameState, PlayerColour, PlayerType, type IGame, type IMoveRaw, type IPremoveQueue } from '@/contracts';
import { MoveHistoryService, SerializationService } from '@/domain';
import { buildFen, createInitialBoardPosition, getOpponentColour, toDetailedMove } from '@/utility/chess';
import { useGamePosition } from '../game/GamePositionComposable';
import { createAssignedEngine, createGame } from './StateStoreTestUtility';

const position = useGamePosition();
const sequences: Array<{ colour: PlayerColour; moves: IMoveRaw[] }> = [
  { colour: PlayerColour.White, moves: [{ from: 6, to: 21 }, { from: 21, to: 38 }] },
  { colour: PlayerColour.Black, moves: [{ from: 62, to: 45 }, { from: 45, to: 30 }] },
];
function _createQueuedGame(colour: PlayerColour, moves: IMoveRaw[]) {
  const local = { colour, type: PlayerType.Local, displayName: 'Human' };
  const engine = { colour: getOpponentColour(colour), type: PlayerType.Engine, displayName: 'Engine', assignedEngine: createAssignedEngine() };
  const rootPosition = createInitialBoardPosition();
  rootPosition.sideToMove = engine.colour;
  const game = position.hydrateGame(createGame({ rootPosition,
    gameState: engine.colour === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn,
    whitePlayer: colour === PlayerColour.White ? local : engine, blackPlayer: colour === PlayerColour.Black ? local : engine,
  }));
  const player = colour === PlayerColour.White ? game.whitePlayer! : game.blackPlayer!;
  game.$!.premoveQueue = { player, moves: structuredClone(moves) };
  return game;
}
describe('premove runtime data boundary', () => {
  it('uses the shared raw move array without an entry wrapper, expected kind or anchor', () => {
    expectTypeOf<IPremoveQueue['moves']>().toEqualTypeOf<IMoveRaw[]>();
    const game = _createQueuedGame(PlayerColour.White, [{ from: 6, to: 21 }, { from: 21, to: 38 }]);
    expect(Object.keys(game.$!.premoveQueue!).sort()).toEqual(['moves', 'player']);
    expect(game.$!.premoveQueue!.moves).toEqual([{ from: 6, to: 21 }, { from: 21, to: 38 }]);
  });
  it.each(sequences)('excludes the $colour queue and its references from canonical saves', ({ colour, moves }) => {
    const game = _createQueuedGame(colour, moves);
    const queue = game.$!.premoveQueue!;
    const withoutQueue: IGame = { ...game, $: undefined };
    const canonical = SerializationService.serialiseGame(withoutQueue);
    expect(SerializationService.serialiseGame(game)).toBe(canonical);
    expect(game.$!.premoveQueue).toBe(queue);
    expect(queue.player).toBe(colour === PlayerColour.White ? game.whitePlayer : game.blackPlayer);
    const restored = position.hydrateGame(SerializationService.deserialiseGame(canonical));
    expect(restored.$!.premoveQueue).toBeUndefined();
    expect(restored.moveTree.root.children).toEqual([]);
    expect(buildFen(restored.rootPosition)).toBe(buildFen(game.rootPosition));
    expect(restored.clockSnapshot).toEqual(game.clockSnapshot);
  });
  it('preserves runtime queue data as the actual live node advances and serialises only played history', () => {
    const game = _createQueuedGame(PlayerColour.Black, sequences[1]!.moves);
    const queue = game.$!.premoveQueue;
    const node = MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    position.appendLivePath(game, node);
    game.gameState = GameState.LiveBlackTurn;
    expect(game.$!.premoveQueue).toBe(queue);
    const restored = SerializationService.deserialiseGame(SerializationService.serialiseGame(game));
    expect(restored.livePath).toEqual([0]);
    expect(restored.moveTree.root.children).toHaveLength(1);
    expect(restored.$).toBeUndefined();
    expect(node.$!.parent).toBe(game.moveTree.root);
  });
  it('discards an old queue on hydration without changing another game or canonical data', () => {
    const game = _createQueuedGame(PlayerColour.White, sequences[0]!.moves);
    const other = _createQueuedGame(PlayerColour.Black, sequences[1]!.moves);
    const queue = game.$!.premoveQueue!;
    const otherQueue = other.$!.premoveQueue;
    const canonical = SerializationService.serialiseGame(game);
    position.hydrateGame(game);
    expect(game.$!.premoveQueue).toBeUndefined();
    expect(other.$!.premoveQueue).toBe(otherQueue);
    expect(SerializationService.serialiseGame(game)).toBe(canonical);
    expect(queue.moves).toEqual(sequences[0]!.moves);
  });
});
