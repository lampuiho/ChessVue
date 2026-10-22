import { PieceKind, PlayerColour, PlayerType, type IBoardPosition, type IChessPiece, type IPlayer, type IPremove } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard } from '@/utility/chess';
import { createAssignedEngine } from './StateStoreTestUtility';

export type PieceFixture = readonly [square: string, colour: PlayerColour, kind: PieceKind];
export interface IPositionFixture {
  pieces: readonly PieceFixture[];
  side?: PlayerColour;
  rights?: Partial<IBoardPosition['castlingAvailability']>;
  enPassant?: string;
}
export function squareId(square: string) {
  return square.charCodeAt(0) - 97 + (Number(square[1]) - 1) * 8;
}
export function premove(uci: string, movingPiece: PieceKind = PieceKind.Knight): IPremove {
  const promotion = { q: PieceKind.Queen, r: PieceKind.Rook, b: PieceKind.Bishop, n: PieceKind.Knight } as const;
  return { from: squareId(uci.slice(0, 2)), to: squareId(uci.slice(2, 4)), movingPiece,
    ...(uci[4] ? { promotionPiece: promotion[uci[4] as keyof typeof promotion] } : {}) };
}
export function fixturePosition(fixture?: IPositionFixture): IBoardPosition {
  if (!fixture) return createInitialBoardPosition();
  const board = createSparseBoard(fixture.pieces.map(([square, colour, kind]) => ({ boardId: squareId(square), piece: { colour, kind } })), fixture.side ?? PlayerColour.Black);
  Object.assign(board.castlingAvailability, fixture.rights);
  if (fixture.enPassant) board.enPassantTarget = squareId(fixture.enPassant);
  return board;
}
export function fixturePlayer(colour: PlayerColour, type: PlayerType): IPlayer {
  return type === PlayerType.Engine
    ? { colour, type, displayName: `${colour} engine`, assignedEngine: createAssignedEngine() } as IPlayer
    : { colour, type, displayName: `${colour} human` };
}
export function localSeat(game: { whitePlayer?: IPlayer; blackPlayer?: IPlayer }, colour: PlayerColour) {
  return (colour === PlayerColour.White ? game.whitePlayer : game.blackPlayer)!;
}
export function pieceMap(board: readonly (IChessPiece | undefined)[]) {
  return Object.fromEntries(board.flatMap((piece, id) => piece ? [[`${String.fromCharCode(97 + id % 8)}${Math.floor(id / 8) + 1}`, `${piece.colour} ${piece.kind}`]] : []));
}
export const whiteChain = [premove('g1f3'), premove('f3g5')];
export const blackChain = [premove('g8f6'), premove('f6g4')];
export const captureSource: IPositionFixture = { pieces: [
  ['e1', PlayerColour.White, PieceKind.King], ['e8', PlayerColour.Black, PieceKind.King],
  ['c3', PlayerColour.White, PieceKind.Knight], ['b4', PlayerColour.Black, PieceKind.Bishop],
  ['h2', PlayerColour.White, PieceKind.Pawn], ['h7', PlayerColour.Black, PieceKind.Pawn],
] };
export const blockedTail: IPositionFixture = { pieces: [
  ['e1', PlayerColour.White, PieceKind.King], ['e8', PlayerColour.Black, PieceKind.King],
  ['g1', PlayerColour.White, PieceKind.Knight], ['f1', PlayerColour.White, PieceKind.Bishop],
  ['d8', PlayerColour.Black, PieceKind.Rook], ['a2', PlayerColour.White, PieceKind.Pawn], ['a7', PlayerColour.Black, PieceKind.Pawn],
] };
export const checkingReply: IPositionFixture = { pieces: [
  ['e1', PlayerColour.White, PieceKind.King], ['a8', PlayerColour.Black, PieceKind.King],
  ['g1', PlayerColour.White, PieceKind.Knight], ['e8', PlayerColour.Black, PieceKind.Rook],
  ['a2', PlayerColour.White, PieceKind.Pawn], ['a7', PlayerColour.Black, PieceKind.Pawn],
] };
export const promotionPosition: IPositionFixture = { side: PlayerColour.Black, pieces: [
  ['e1', PlayerColour.White, PieceKind.King], ['e8', PlayerColour.Black, PieceKind.King],
  ['a7', PlayerColour.White, PieceKind.Pawn], ['h7', PlayerColour.Black, PieceKind.Pawn],
] };
export const castlePosition: IPositionFixture = { side: PlayerColour.Black, rights: { whiteKingSide: true }, pieces: [
  ['e1', PlayerColour.White, PieceKind.King], ['h1', PlayerColour.White, PieceKind.Rook],
  ['e8', PlayerColour.Black, PieceKind.King], ['h7', PlayerColour.Black, PieceKind.Pawn],
] };
