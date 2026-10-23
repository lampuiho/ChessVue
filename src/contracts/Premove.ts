import type { IPlayer } from './Game';
import type { IMoveRaw } from './Move';
/** Runtime FIFO owned by one live game and its actual local seat. */
export interface IPremoveQueue {
  player: IPlayer;
  moves: IMoveRaw[];
}
