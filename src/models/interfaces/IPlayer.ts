import type { PlayerType } from "../enums/PlayerType";

export default interface IPlayer {
  id: string;
  name: string;
  type: PlayerType;
  isWhite: boolean;
}