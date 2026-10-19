import { GameState, PlayerColour, type IGame } from '@/contracts';
import { ClockTimestamp } from '@/utility/date';
import { getPosition } from './HistoryFixtureBuilder';

export function setPausedClock(game: IGame, remainingMs: number, now: number) {
  const colour = getPosition(game, game.livePath ?? game.renderedPath).sideToMove;
  game.clockSnapshot = {
    white: { remainingMs, isRunning: false }, black: { remainingMs, isRunning: false },
    activeColour: colour, pausedAtUtc: new ClockTimestamp(now),
  };
  game.gameState = colour === PlayerColour.White ? GameState.PausedWhiteTurn : GameState.PausedBlackTurn;
  let node = game.moveTree.root;
  for (const index of game.livePath ?? []) node = node.children[index]!;
  node.clockSnapshot = game.clockSnapshot;
}
