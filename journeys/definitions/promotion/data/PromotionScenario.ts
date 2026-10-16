import { PieceKind, PlayerColour } from '../../../../src/contracts';
export interface IPromotionScenario {
  colour: PlayerColour;
  opponent: PlayerColour;
  from: string;
  quiet: string;
  capture: string;
  fromId: number;
  quietId: number;
  captureId: number;
  kingFrom: string;
  kingTo: string;
}
export const promotionScenarios: IPromotionScenario[] = [
  { colour: PlayerColour.White, opponent: PlayerColour.Black, from: 'a7', quiet: 'a8', capture: 'b8', fromId: 48, quietId: 56, captureId: 57, kingFrom: 'e1', kingTo: 'd1' },
  { colour: PlayerColour.Black, opponent: PlayerColour.White, from: 'h2', quiet: 'h1', capture: 'g1', fromId: 15, quietId: 7, captureId: 6, kingFrom: 'e8', kingTo: 'd8' },
];
export const promotionPieces = [
  { kind: PieceKind.Queen, letter: 'Q' }, { kind: PieceKind.Rook, letter: 'R' },
  { kind: PieceKind.Bishop, letter: 'B' }, { kind: PieceKind.Knight, letter: 'N' },
];
export const promotionGestures = [
  { gesture: 'drag', orientation: 'white' }, { gesture: 'drag', orientation: 'black' },
  { gesture: 'click', orientation: 'black' },
] as const;
