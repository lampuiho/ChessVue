import type { ChessPiece } from "../enums/ChessPiece";

export default interface IChessPiece {
  chess: ChessPiece;
  isWhite: boolean;
}