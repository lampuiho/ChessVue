import { MoveKind, PieceKind, PlayerColour, ResultReason, ResultState, type BoardId, type IBoardPosition, type IMove } from '@/contracts';
import { cloneBoardPosition, findKingBoardId, getOpponentColour, normaliseBoardPosition } from './BoardUtility';
import { boardIdToCoords, coordsToBoardId, getForwardDirection, getPawnHomeRank, getPromotionRank } from './SquareUtility';

type ICandidateMove = IMove;
const promotionPieces: PieceKind[] = [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight];
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

function getPiece(position: IBoardPosition, boardId: BoardId) {
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
function generatePseudoLegalMoves(position: IBoardPosition, colour: PlayerColour): ICandidateMove[] {
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
function isSquareAttacked(position: IBoardPosition, target: BoardId, byColour: PlayerColour): boolean {
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
function updateCastlingAvailability(position: IBoardPosition, move: ICandidateMove): IBoardPosition['castlingAvailability'] {
  const nextCastlingAvailability = { ...position.castlingAvailability };
  const movingPiece = getPiece(position, move.from);
  const capturedPiece = move.kind === MoveKind.EnPassant ? undefined : getPiece(position, move.to);
  if (movingPiece?.kind === PieceKind.King) {
    if (movingPiece.colour === PlayerColour.White) {
      nextCastlingAvailability.whiteKingSide = false;
      nextCastlingAvailability.whiteQueenSide = false;
    } else {
      nextCastlingAvailability.blackKingSide = false;
      nextCastlingAvailability.blackQueenSide = false;
    }
  }
  if (movingPiece?.kind === PieceKind.Rook) {
    if (move.from === 0) nextCastlingAvailability.whiteQueenSide = false;
    if (move.from === 7) nextCastlingAvailability.whiteKingSide = false;
    if (move.from === 56) nextCastlingAvailability.blackQueenSide = false;
    if (move.from === 63) nextCastlingAvailability.blackKingSide = false;
  }
  if (capturedPiece?.kind === PieceKind.Rook) {
    if (move.to === 0) nextCastlingAvailability.whiteQueenSide = false;
    if (move.to === 7) nextCastlingAvailability.whiteKingSide = false;
    if (move.to === 56) nextCastlingAvailability.blackQueenSide = false;
    if (move.to === 63) nextCastlingAvailability.blackKingSide = false;
  }
  return nextCastlingAvailability;
}
function applyCandidateMove(position: IBoardPosition, move: ICandidateMove): IBoardPosition {
  const movingPiece = getPiece(position, move.from);
  if (movingPiece === undefined) throw new Error(`No piece found on ${move.from}.`);
  if (move.kind === MoveKind.Promotion && move.promotionPiece === undefined) throw new Error('Promotion piece selection is required before applying a promotion move.');
  const nextPosition = cloneBoardPosition(position);
  nextPosition.board[move.from] = undefined;
  let isCapture = getPiece(position, move.to) !== undefined;
  if (move.kind === MoveKind.EnPassant) {
    const fromCoords = boardIdToCoords(move.from);
    const toCoords = boardIdToCoords(move.to);
    const capturedBoardId = coordsToBoardId(toCoords.file, fromCoords.rank);
    if (capturedBoardId !== undefined) {
      nextPosition.board[capturedBoardId] = undefined;
      isCapture = true;
    }
  }
  if (move.kind === MoveKind.Castle) {
    const homeRank = movingPiece.colour === PlayerColour.White ? 0 : 7;
    const isKingSide = boardIdToCoords(move.to).file === 6;
    const rookFrom = coordsToBoardId(isKingSide ? 7 : 0, homeRank);
    const rookTo = coordsToBoardId(isKingSide ? 5 : 3, homeRank);
    if (rookFrom !== undefined && rookTo !== undefined) {
      const rook = getPiece(position, rookFrom);
      if (rook !== undefined) {
        nextPosition.board[rookFrom] = undefined;
        nextPosition.board[rookTo] = rook;
      }
    }
  }
  nextPosition.board[move.to] = move.kind === MoveKind.Promotion ? { kind: move.promotionPiece!, colour: movingPiece.colour } : movingPiece;
  nextPosition.castlingAvailability = updateCastlingAvailability(position, move);
  nextPosition.enPassantTarget = undefined;
  const fromCoords = boardIdToCoords(move.from);
  const toCoords = boardIdToCoords(move.to);
  if (movingPiece.kind === PieceKind.Pawn && Math.abs(toCoords.rank - fromCoords.rank) === 2) nextPosition.enPassantTarget = coordsToBoardId(fromCoords.file, fromCoords.rank + getForwardDirection(movingPiece.colour));
  nextPosition.halfMoveClock = movingPiece.kind === PieceKind.Pawn || isCapture ? 0 : position.halfMoveClock + 1;
  nextPosition.fullMoveNumber = movingPiece.colour === PlayerColour.Black ? position.fullMoveNumber + 1 : position.fullMoveNumber;
  nextPosition.sideToMove = getOpponentColour(movingPiece.colour);
  return normaliseBoardPosition(nextPosition);
}
function moveMatches(candidate: Pick<IMove, 'from' | 'to' | 'kind' | 'movingColour' | 'promotionPiece'>, move: IMove): boolean {
  if (candidate.from !== move.from || candidate.to !== move.to || candidate.kind !== move.kind || candidate.movingColour !== move.movingColour) return false;
  if (candidate.kind !== MoveKind.Promotion) return candidate.promotionPiece === move.promotionPiece;
  return move.promotionPiece === undefined || promotionPieces.includes(move.promotionPiece);
}
function hasInsufficientMaterial(position: IBoardPosition): boolean {
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

export function isMoveLegal(position: IBoardPosition, move: IMove): boolean {
  const movingPiece = getPiece(position, move.from);
  if (movingPiece === undefined || movingPiece.colour !== move.movingColour) return false;
  const promotionResolvedMoves = move.kind === MoveKind.Promotion && move.promotionPiece === undefined
    ? promotionPieces.map((piece) => ({ ...move, promotionPiece: piece }))
    : [move];
  return promotionResolvedMoves.some((resolvedMove) => {
    const nextPosition = applyCandidateMove(position, resolvedMove);
    return !isSquareAttacked(nextPosition, findKingBoardId(nextPosition, move.movingColour)!, getOpponentColour(move.movingColour));
  });
}
export function generateLegalMoves(position: IBoardPosition): IMove[] {
  const normalisedPosition = normaliseBoardPosition(position);
  return generatePseudoLegalMoves(normalisedPosition, normalisedPosition.sideToMove)
    .filter((candidate) => isMoveLegal(normalisedPosition, candidate));
}
export function requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean {
  const piece = getPiece(position, move.from);
  if (piece?.kind !== PieceKind.Pawn) return false;
  return boardIdToCoords(move.to).rank === getPromotionRank(piece.colour) && move.promotionPiece === undefined;
}
export function applyMove(position: IBoardPosition, move: IMove): IBoardPosition {
  const legalMoves = generateLegalMoves(position);
  const matchingMove = legalMoves.find((candidate) => moveMatches(candidate, move));
  if (!matchingMove) throw new Error('Cannot apply an illegal move.');
  if (requiresPromotionSelection(position, move)) throw new Error('Promotion piece selection is required before applying a promotion move.');
  //TODO: update check state of the position
  return applyCandidateMove(position, {
    from: matchingMove.from,
    to: matchingMove.to,
    kind: matchingMove.kind,
    movingColour: matchingMove.movingColour,
    promotionPiece: move.promotionPiece,
  });
}
export function resolveResult(position: IBoardPosition): { resultState: ResultState; resultReason: ResultReason | undefined; } {
  if (hasInsufficientMaterial(position)) return { resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved };
  const legalMoves = generateLegalMoves(position);
  if (legalMoves.length > 0) return { resultState: ResultState.Ongoing, resultReason: undefined };
  const kingBoardId = findKingBoardId(position, position.sideToMove);
  if (kingBoardId !== undefined && isSquareAttacked(position, kingBoardId, getOpponentColour(position.sideToMove))) {
    return {
      resultState: position.sideToMove === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon,
      resultReason: ResultReason.RuleResolved,
    };
  }
  return { resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved };
}
