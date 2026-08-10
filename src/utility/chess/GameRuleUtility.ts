import { MoveKind, PieceKind, PlayerColour, type BoardId, type IBoardPosition, type IMove } from '@/contracts';
import { getOpponentColour } from './BoardUtility';
import { boardIdToCoords, coordsToBoardId, getForwardDirection, getPawnHomeRank, getPromotionRank } from './SquareUtility';

type ICandidateMove = IMove;
export const promotionPieces: PieceKind[] = [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight];

const knightOffsets = [
  { file: -2, rank: -1 },
  { file: -2, rank: 1 },
  { file: -1, rank: -2 },
  { file: -1, rank: 2 },
  { file: 1, rank: -2 },
  { file: 1, rank: 2 },
  { file: 2, rank: -1 },
  { file: 2, rank: 1 },
];
const bishopDirections = [
  { file: -1, rank: -1 },
  { file: -1, rank: 1 },
  { file: 1, rank: -1 },
  { file: 1, rank: 1 },
];
const rookDirections = [
  { file: -1, rank: 0 },
  { file: 1, rank: 0 },
  { file: 0, rank: -1 },
  { file: 0, rank: 1 },
];
const queenDirections = [...bishopDirections, ...rookDirections];
const kingOffsets = [
  { file: -1, rank: -1 },
  { file: -1, rank: 0 },
  { file: -1, rank: 1 },
  { file: 0, rank: -1 },
  { file: 0, rank: 1 },
  { file: 1, rank: -1 },
  { file: 1, rank: 0 },
  { file: 1, rank: 1 },
];
export function getPiece(position: IBoardPosition, boardId: BoardId) {
  return position.board[boardId];
}
function isOccupied(position: IBoardPosition, boardId: BoardId): boolean {
  return getPiece(position, boardId) !== undefined;
}
function isOccupiedByColour(position: IBoardPosition, boardId: BoardId, colour: PlayerColour): boolean {
  return getPiece(position, boardId)?.colour === colour;
}
function addSlidingMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, directions: Array<{ file: number; rank: number }>, accumulator: ICandidateMove[]): void {
  const origin = boardIdToCoords(from);
  for (const direction of directions) {
    let file = origin.file + direction.file;
    let rank = origin.rank + direction.rank;
    while (true) {
      const target = coordsToBoardId(file, rank);
      if (target === undefined) break;
      if (isOccupiedByColour(position, target, colour)) break;
      accumulator.push({ from, to: target, kind: MoveKind.Normal, movingColour: colour });
      if (isOccupied(position, target)) break;
      file += direction.file;
      rank += direction.rank;
    }
  }
}
function addPawnMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = boardIdToCoords(from);
  const direction = getForwardDirection(colour);
  const oneForward = coordsToBoardId(origin.file, origin.rank + direction);
  if (oneForward !== undefined && !isOccupied(position, oneForward)) {
    const isPromotion = boardIdToCoords(oneForward).rank === getPromotionRank(colour);
    accumulator.push({ from, to: oneForward, kind: isPromotion ? MoveKind.Promotion : MoveKind.Normal, movingColour: colour });
    if (origin.rank === getPawnHomeRank(colour)) {
      const twoForward = coordsToBoardId(origin.file, origin.rank + (direction * 2));
      if (twoForward !== undefined && !isOccupied(position, twoForward)) accumulator.push({ from, to: twoForward, kind: MoveKind.Normal, movingColour: colour });
    }
  }
  for (const fileOffset of [-1, 1]) {
    const target = coordsToBoardId(origin.file + fileOffset, origin.rank + direction);
    if (target === undefined) continue;
    const targetPiece = getPiece(position, target);
    const isPromotion = boardIdToCoords(target).rank === getPromotionRank(colour);
    if (targetPiece !== undefined && targetPiece.colour !== colour) accumulator.push({ from, to: target, kind: isPromotion ? MoveKind.Promotion : MoveKind.Normal, movingColour: colour });
    if (position.enPassantTarget === target) {
      const capturedBoardId = coordsToBoardId(origin.file + fileOffset, origin.rank);
      const capturedPiece = capturedBoardId === undefined ? undefined : getPiece(position, capturedBoardId);
      if (capturedPiece?.kind === PieceKind.Pawn && capturedPiece.colour !== colour) accumulator.push({ from, to: target, kind: MoveKind.EnPassant, movingColour: colour });
    }
  }
}
function addKnightMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = boardIdToCoords(from);
  for (const offset of knightOffsets) {
    const target = coordsToBoardId(origin.file + offset.file, origin.rank + offset.rank);
    if (target === undefined || isOccupiedByColour(position, target, colour)) continue;
    accumulator.push({ from, to: target, kind: MoveKind.Normal, movingColour: colour });
  }
}
function addKingMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, accumulator: ICandidateMove[]): void {
  const origin = boardIdToCoords(from);
  for (const offset of kingOffsets) {
    const target = coordsToBoardId(origin.file + offset.file, origin.rank + offset.rank);
    if (target === undefined || isOccupiedByColour(position, target, colour)) continue;
    accumulator.push({ from, to: target, kind: MoveKind.Normal, movingColour: colour });
  }
  const enemyColour = getOpponentColour(colour);
  const homeRank = colour === PlayerColour.White ? 0 : 7;
  const kingBoardId = coordsToBoardId(4, homeRank);
  if (kingBoardId !== from || isSquareAttacked(position, from, enemyColour)) return;
  const kingSidePath = [coordsToBoardId(5, homeRank), coordsToBoardId(6, homeRank)];
  const queenSidePath = [coordsToBoardId(3, homeRank), coordsToBoardId(2, homeRank)];
  const kingSideClear = kingSidePath.every((boardId) => boardId !== undefined && !isOccupied(position, boardId));
  const queenSideClear = [coordsToBoardId(1, homeRank), ...queenSidePath].every((boardId) => boardId !== undefined && !isOccupied(position, boardId));
  const rookKingSide = coordsToBoardId(7, homeRank);
  const rookQueenSide = coordsToBoardId(0, homeRank);
  if ((colour === PlayerColour.White ? position.castlingAvailability.whiteKingSide : position.castlingAvailability.blackKingSide)
    && rookKingSide !== undefined
    && getPiece(position, rookKingSide)?.kind === PieceKind.Rook
    && kingSideClear
    && kingSidePath.every((boardId) => boardId !== undefined && !isSquareAttacked(position, boardId, enemyColour))) {
    const target = coordsToBoardId(6, homeRank);
    if (target !== undefined) accumulator.push({ from, to: target, kind: MoveKind.Castle, movingColour: colour });
  }
  if ((colour === PlayerColour.White ? position.castlingAvailability.whiteQueenSide : position.castlingAvailability.blackQueenSide)
    && rookQueenSide !== undefined
    && getPiece(position, rookQueenSide)?.kind === PieceKind.Rook
    && queenSideClear
    && queenSidePath.every((boardId) => boardId !== undefined && !isSquareAttacked(position, boardId, enemyColour))) {
    const target = coordsToBoardId(2, homeRank);
    if (target !== undefined) accumulator.push({ from, to: target, kind: MoveKind.Castle, movingColour: colour });
  }
}
export function generatePseudoLegalMoves(position: IBoardPosition, colour: PlayerColour): ICandidateMove[] {
  const accumulator: ICandidateMove[] = [];
  for (let boardId = 0; boardId < position.board.length; boardId += 1) {
    const piece = position.board[boardId];
    if (piece?.colour !== colour) continue;
    const from = boardId;
    switch (piece.kind) {
      case PieceKind.Pawn:
        addPawnMoves(position, from, colour, accumulator);
        break;
      case PieceKind.Knight:
        addKnightMoves(position, from, colour, accumulator);
        break;
      case PieceKind.Bishop:
        addSlidingMoves(position, from, colour, bishopDirections, accumulator);
        break;
      case PieceKind.Rook:
        addSlidingMoves(position, from, colour, rookDirections, accumulator);
        break;
      case PieceKind.Queen:
        addSlidingMoves(position, from, colour, queenDirections, accumulator);
        break;
      case PieceKind.King:
        addKingMoves(position, from, colour, accumulator);
        break;
    }
  }
  return accumulator;
}
export function isSquareAttacked(position: IBoardPosition, target: BoardId, byColour: PlayerColour): boolean {
  const targetCoords = boardIdToCoords(target);
  const pawnRank = targetCoords.rank - getForwardDirection(byColour);
  for (const fileOffset of [-1, 1]) {
    const attackerBoardId = coordsToBoardId(targetCoords.file + fileOffset, pawnRank);
    if (attackerBoardId !== undefined) {
      const attacker = getPiece(position, attackerBoardId);
      if (attacker?.colour === byColour && attacker.kind === PieceKind.Pawn) return true;
    }
  }
  for (const offset of knightOffsets) {
    const attackerBoardId = coordsToBoardId(targetCoords.file + offset.file, targetCoords.rank + offset.rank);
    if (attackerBoardId !== undefined) {
      const attacker = getPiece(position, attackerBoardId);
      if (attacker?.colour === byColour && attacker.kind === PieceKind.Knight) return true;
    }
  }
  for (const direction of bishopDirections) {
    let file = targetCoords.file + direction.file;
    let rank = targetCoords.rank + direction.rank;
    while (true) {
      const attackerBoardId = coordsToBoardId(file, rank);
      if (attackerBoardId === undefined) break;
      const attacker = getPiece(position, attackerBoardId);
      if (attacker !== undefined) {
        if (attacker.colour === byColour && (attacker.kind === PieceKind.Bishop || attacker.kind === PieceKind.Queen)) return true;
        break;
      }
      file += direction.file;
      rank += direction.rank;
    }
  }
  for (const direction of rookDirections) {
    let file = targetCoords.file + direction.file;
    let rank = targetCoords.rank + direction.rank;
    while (true) {
      const attackerBoardId = coordsToBoardId(file, rank);
      if (attackerBoardId === undefined) break;
      const attacker = getPiece(position, attackerBoardId);
      if (attacker !== undefined) {
        if (attacker.colour === byColour && (attacker.kind === PieceKind.Rook || attacker.kind === PieceKind.Queen)) return true;
        break;
      }
      file += direction.file;
      rank += direction.rank;
    }
  }
  for (const offset of kingOffsets) {
    const attackerBoardId = coordsToBoardId(targetCoords.file + offset.file, targetCoords.rank + offset.rank);
    if (attackerBoardId !== undefined) {
      const attacker = getPiece(position, attackerBoardId);
      if (attacker?.colour === byColour && attacker.kind === PieceKind.King) return true;
    }
  }
  return false;
}
export function moveMatches(candidate: Pick<IMove, 'from' | 'to' | 'kind' | 'movingColour' | 'promotionPiece'>, move: IMove): boolean {
  if (candidate.from !== move.from || candidate.to !== move.to || candidate.kind !== move.kind || candidate.movingColour !== move.movingColour) return false;
  if (candidate.kind !== MoveKind.Promotion) return candidate.promotionPiece === move.promotionPiece;
  return move.promotionPiece === undefined || promotionPieces.includes(move.promotionPiece);
}
export function hasInsufficientMaterial(position: IBoardPosition): boolean {
  const pieces = position.board;
  const nonKingPieces = pieces.filter((piece): piece is NonNullable<typeof piece> => piece !== undefined && piece.kind !== PieceKind.King);
  if (nonKingPieces.length === 0) return true;
  const firstNonKingPiece = nonKingPieces[0];
  if (firstNonKingPiece === undefined) return true;
  if (nonKingPieces.length === 1) return firstNonKingPiece.kind === PieceKind.Bishop || firstNonKingPiece.kind === PieceKind.Knight;
  if (nonKingPieces.length === 2) {
    const disallowed = nonKingPieces.some((piece) => piece.kind === PieceKind.Queen || piece.kind === PieceKind.Rook || piece.kind === PieceKind.Pawn);
    if (disallowed) return false;
    const bishopKnightCount = nonKingPieces.filter((piece) => piece.kind === PieceKind.Bishop || piece.kind === PieceKind.Knight).length;
    return bishopKnightCount === 2;
  }
  return false;
}
