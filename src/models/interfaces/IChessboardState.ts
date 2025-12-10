import type { ChessPiece } from "../enums/ChessPiece";
import type { MovePermission } from "../enums/MovePermission";

interface IChessPiece {
  chess: ChessPiece;
  side: boolean;
}
export default interface IChessboardState {
  cells: (IChessPiece|null)[]; //expects 64 elements 8x8 square
  turn: MovePermission;
}
