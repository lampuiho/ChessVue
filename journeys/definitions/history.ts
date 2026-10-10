import { appendMoves, createGame, createWorkspace } from '../FixtureFactory';
export function create() {
  const games = [true, false].map((allowTakeback) => {
    const game = createGame(`history-${allowTakeback ? 'allowed' : 'blocked'}`, `Takeback ${allowTakeback ? 'allowed' : 'blocked'}`, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'], { allowTakeback });
    const branch = appendMoves(game, [0, 0], ['f1c4', 'g8f6', 'd2d3']);
    appendMoves(game, branch.slice(0, -1), ['b1c3']);
    appendMoves(game, [0], ['c7c5', 'g1f3', 'b8c6', 'd2d4']);
    return game;
  });
  return createWorkspace(games);
}
