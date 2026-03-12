import type IChessBoardState from "./IChessboardState";
import type IPlayer from "./IPlayer";

export default interface IGame {
  chessBoardState: IChessBoardState;
  playerWhite: IPlayer;
  playerBlack: IPlayer;
}
