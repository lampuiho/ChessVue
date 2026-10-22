import type { BoardId, PieceKind } from './Chess';
import type { IPlayer } from './Game';

/** A future local intention; colour belongs to the queue's player, and chess details are resolved when due. */
export interface IPremove {
  from: BoardId;
  to: BoardId;
  movingPiece: PieceKind;
  promotionPiece?: PieceKind.Queen | PieceKind.Rook | PieceKind.Bishop | PieceKind.Knight;
}
/** Runtime FIFO owned by one live game and its actual local seat. */
export interface IPremoveQueue {
  player: IPlayer;
  moves: IPremove[];
}
