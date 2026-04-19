import type { IMove } from "@/contracts";

export default class InvalidMove extends Error {
  constructor(move: IMove) {
    super();
    console.error('illegal move from', move.movingColour, move);
  }
}
