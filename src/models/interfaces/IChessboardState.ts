import type IChessPiece from "./IChessPiece";
import type { MovePermission } from "../enums/MovePermission";

export default interface IChessboardState {
  cells: (IChessPiece|null)[]; //expects 64 elements 8x8 square
  turn: MovePermission;
}
