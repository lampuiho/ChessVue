import { PieceKind, PlayerColour, type IBoardPosition } from '@/contracts';
import { createSparseBoard, getOpponentColour } from '@/utility/chess';
export const ruleColours = [PlayerColour.White, PlayerColour.Black] as const;
export const castleSides = ['king', 'queen'] as const;
export const castleObstacles = ['in-check', 'through-attack', 'occupied-path', 'king-moved', 'rook-moved'] as const;
export type CastleSide = typeof castleSides[number];
export type CastleObstacle = typeof castleObstacles[number];
export function ruleSquare(square: string, colour: PlayerColour): string {
  return colour === PlayerColour.White ? square : square[0]! + (9 - Number(square[1]));
}
export function ruleBoardId(square: string): number {
  return square.charCodeAt(0) - 97 + (Number(square[1]) - 1) * 8;
}
export function rulePosition(own: Array<[string, PieceKind]>, opponent: Array<[string, PieceKind]>, colour: PlayerColour, side = colour): IBoardPosition {
  const pieces = (entries: Array<[string, PieceKind]>, pieceColour: PlayerColour) => entries.map(([square, kind]) => ({
    boardId: ruleBoardId(ruleSquare(square, colour)), piece: { kind, colour: pieceColour },
  }));
  return createSparseBoard([...pieces(own, colour), ...pieces(opponent, getOpponentColour(colour))], side);
}
export function ruleUci(uci: string, colour: PlayerColour): string {
  return ruleSquare(uci.slice(0, 2), colour) + ruleSquare(uci.slice(2, 4), colour);
}
