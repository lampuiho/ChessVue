import { AmbiguityKind, CheckState, MoveKind, PieceKind, PlayerColour, ResultReason, ResultState, type BoardId, type IBoardPosition, type IMove, type IMoveCandidate, type IMoveRaw } from '@/contracts';
import type { IChessPiece } from '@/contracts/Chess';
import { findKingBoardId, getOpponentColour } from './BoardUtility';
import { boardIdToCoords, coordsToBoardId, getForwardDirection, getPawnHomeRank, getPromotionRank, tryCoordsToBoardId } from './SquareUtility';
import { throwReferenceError } from '../errors/StandardErrorHandlingUtility';

const enum CastlingType {
  NotCastling,
  CastlingKingSide,
  CastlingQueenSide,
}
const enum OccupancyKind {
  Empty,
  Self,
  Opponent,
}
interface IKingAttackState {
  attackMask: number[];
  kingAttacks: IMoveRaw[];
}
const promotionPieces: PieceKind[] = [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight];
const standardInitialBackRank = [PieceKind.Rook, PieceKind.Knight, PieceKind.Bishop, PieceKind.Queen, PieceKind.King, PieceKind.Bishop, PieceKind.Knight, PieceKind.Rook] as const;


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
const standardInitialBoard: IBoardPosition['board'] = Array.from({ length: 64 }, (_, boardId) => {
  const rank = Math.floor(boardId / 8);
  if (rank > 1 && rank < 6) return;
  const colour = rank < 2 ? PlayerColour.White : PlayerColour.Black;
  const kind = rank === 1 || rank === 6 ? PieceKind.Pawn : standardInitialBackRank[boardId % 8]!;
  return { kind, colour };
});

function _getPiece(position: IBoardPosition, boardId: BoardId) {
  return position.board[boardId];
}
function isOccupied(position: IBoardPosition, boardId: BoardId): boolean {
  return _getPiece(position, boardId) != null;
}
function getOccupancyKind(position: IBoardPosition, boardId: BoardId, colour: PlayerColour): OccupancyKind {
  const piece = _getPiece(position, boardId);
  if (!piece) return OccupancyKind.Empty;
  return piece.colour === colour ? OccupancyKind.Self : OccupancyKind.Opponent;
}
function _genDirectionalMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, directions: Array<{ file: number; rank: number }>) {
  const origin = boardIdToCoords(from);
  const moves = [] as IMoveRaw[];
  for (const direction of directions) {
    let through = true
    let file = origin.file + direction.file;
    let rank = origin.rank + direction.rank;
    while (through) {
      const target = tryCoordsToBoardId(file, rank);
      if (target == null) break;
      moves.push({ from, to: target });
      through = !isOccupied(position, target)
      file += direction.file;
      rank += direction.rank;
    }
  }
  return moves;
}
function _genPawnMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour)
{
  const moves = [] as IMoveRaw[];
  const origin = boardIdToCoords(from);
  const direction = getForwardDirection(colour);
  const rank = origin.rank + direction;
  const isPromotion = rank === getPromotionRank(colour);
  function pushMove(move: IMoveRaw) {
    if (isPromotion) moves.push(...promotionPieces.map(promotionPiece => ({ ...move, promotionPiece })));
    else moves.push(move);
  }
  const oneForward = tryCoordsToBoardId(origin.file, rank);
  if (oneForward != null && !isOccupied(position, oneForward)) {
    pushMove({ from, to: oneForward });
    if (origin.rank === getPawnHomeRank(colour)) {
      const twoForward = tryCoordsToBoardId(origin.file, origin.rank + (direction * 2));
      if (twoForward != null && !isOccupied(position, twoForward))
        moves.push({ from, to: twoForward });
    }
  }
  for (const move of _genPawnAttackMoves(from, colour)) {
    const target = move.to;
    const isOccupiedByOpponent = getOccupancyKind(position, target, colour) === OccupancyKind.Opponent;
    if (isOccupiedByOpponent) pushMove(move);
    else if (position.enPassantTarget === target) {
      const capturedPawn = _getPiece(position, coordsToBoardId(boardIdToCoords(target).file, origin.rank));
      if (capturedPawn?.colour !== colour && capturedPawn?.kind === PieceKind.Pawn) moves.push(move);
    }
  }
  return moves;
}
function _genPawnAttackMoves(from: BoardId, colour: PlayerColour): IMoveRaw[] {
  const origin = boardIdToCoords(from);
  const rank = origin.rank + getForwardDirection(colour);
  return [-1, 1]
    .map(fileOffset => tryCoordsToBoardId(origin.file + fileOffset, rank))
    .filter((to): to is BoardId => to != null)
    .map(to => ({ from, to }));
}
function _genOffsetMoves(from: BoardId, offsets: Array<{ file: number; rank: number }>) {
  const candidateBoardPos = offsets.map(({ file, rank }) => {
    const target = tryCoordsToBoardId(boardIdToCoords(from).file + file, boardIdToCoords(from).rank + rank);
    return target
  }).filter((boardId): boardId is BoardId => boardId != null);
  return candidateBoardPos.map((to) => ({ from, to }));
}
// these pseudo legal moves may include walking into checks or capturing the king or owned pieces but are otherwise moves that the pieces can move to/attack
// does not include castling moves for the king, as those don't lead to capture
function _genPieceMoves(position: IBoardPosition, from: BoardId, piece: IChessPiece): IMoveRaw[] {
  switch(piece.kind) {
    case PieceKind.Pawn: return _genPawnMoves(position, from, piece.colour);
    case PieceKind.Knight: return _genOffsetMoves(from, knightOffsets);
    case PieceKind.Bishop: return _genDirectionalMoves(position, from, piece.colour, bishopDirections);
    case PieceKind.Rook: return _genDirectionalMoves(position, from, piece.colour, rookDirections);
    case PieceKind.Queen: return _genDirectionalMoves(position, from, piece.colour, queenDirections);
    case PieceKind.King: return _genOffsetMoves(from, kingOffsets);
  }
}
function _genPieceAttack(position: IBoardPosition, from: BoardId, piece: IChessPiece): IMoveRaw[] {
  switch(piece.kind) {
    case PieceKind.Pawn: return _genPawnAttackMoves(from, piece.colour);
    case PieceKind.Knight: return _genOffsetMoves(from, knightOffsets);
    case PieceKind.Bishop: return _genDirectionalMoves(position, from, piece.colour, bishopDirections);
    case PieceKind.Rook: return _genDirectionalMoves(position, from, piece.colour, rookDirections);
    case PieceKind.Queen: return _genDirectionalMoves(position, from, piece.colour, queenDirections);
    case PieceKind.King: return _genOffsetMoves(from, kingOffsets);
  }
}
// generates the non-king moves that pieces can make before checking whether they expose their king
function _genPseudoLegalNonKingMoves(position: IBoardPosition, colour: PlayerColour): IMoveRaw[] {
  const moves = [] as IMoveRaw[];
  for (let boardId = 0; boardId < position.board.length; boardId += 1) {
    const piece = position.board[boardId];
    if (piece?.colour !== colour || piece.kind === PieceKind.King) continue;
    moves.push(..._genPieceMoves(position, boardId, piece));
  }
  return moves;
}
function genPieceAttacks(position: IBoardPosition, colour: PlayerColour): IMoveRaw[] {
  const attacks: IMoveRaw[] = [];
  for (let boardId = 0; boardId < position.board.length; boardId += 1) {
    const piece = position.board[boardId];
    if (piece?.colour !== colour) continue;
    attacks.push(..._genPieceAttack(position, boardId, piece));
  }
  return attacks;
}
function genSquareAttackMask(position: IBoardPosition, attackerColour: PlayerColour, kingBoardId: BoardId): IKingAttackState {
  const attackMask = Array<number>(64).fill(0);
  const kingAttacks: IMoveRaw[] = [];
  for (const attack of genPieceAttacks(position, attackerColour)) {
    attackMask[attack.to] = (attackMask[attack.to] ?? 0) + 1;
    if (attack.to === kingBoardId) kingAttacks.push(attack);
  }
  return { attackMask, kingAttacks };
}
function _isAttackedByDirection(position: IBoardPosition, target: BoardId, byColour: PlayerColour, directions: Array<{ file: number; rank: number }>, kinds: PieceKind[]): boolean {
  const targetCoords = boardIdToCoords(target);
  for (const direction of directions) {
    let file = targetCoords.file + direction.file;
    let rank = targetCoords.rank + direction.rank;
    while (true) {
      const attackerBoardId = tryCoordsToBoardId(file, rank);
      if (attackerBoardId === undefined) break;
      const attacker = _getPiece(position, attackerBoardId);
      if (attacker) {
        if (attacker.colour === byColour && kinds.includes(attacker.kind)) return true;
        break;
      }
      file += direction.file;
      rank += direction.rank;
    }
  }
  return false;
}
function hasInsufficientMaterial(position: IBoardPosition): boolean {
  let minorCount = 0;
  let bishopSquareColour: number | undefined;
  let onlySameColourBishops = true;
  for (let boardId = 0; boardId < position.board.length; boardId += 1) {
    const piece = position.board[boardId];
    if (piece === undefined || piece.kind === PieceKind.King) continue;
    if (piece.kind !== PieceKind.Bishop && piece.kind !== PieceKind.Knight) return false;
    minorCount += 1;
    if (piece.kind === PieceKind.Knight) onlySameColourBishops = false;
    else {
      const { file, rank } = boardIdToCoords(boardId);
      const squareColour = (file + rank) % 2;
      bishopSquareColour ??= squareColour;
      if (bishopSquareColour !== squareColour) onlySameColourBishops = false;
    }
  }
  return minorCount <= 1 || onlySameColourBishops;
}
export function cloneBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    ...position,
    board: [...position.board],
    castlingAvailability: { ...position.castlingAvailability },
  };
}
function getMoveCastlingType(move: IMoveRaw): CastlingType {
  const fromCoords = boardIdToCoords(move.from);
  const toCoords = boardIdToCoords(move.to);
  const diff = toCoords.file - fromCoords.file;
  if (diff > 1) return CastlingType.CastlingKingSide;
  else if (diff < -1) return CastlingType.CastlingQueenSide;
  return CastlingType.NotCastling;
}
function getCastlingRookBoardId(position: IBoardPosition, colour: PlayerColour, type: CastlingType): BoardId | undefined {
  if (type === CastlingType.NotCastling) return;
  if (colour === PlayerColour.White) {
    if (type === CastlingType.CastlingKingSide) return position.castlingRook?.whiteKingSide ?? coordsToBoardId(7, 0);
    return position.castlingRook?.whiteQueenSide ?? coordsToBoardId(0, 0);
  }
  if (type === CastlingType.CastlingKingSide) return position.castlingRook?.blackKingSide ?? coordsToBoardId(7, 7);
  return position.castlingRook?.blackQueenSide ?? coordsToBoardId(0, 7);
}
function getCastlingSideForRook(position: IBoardPosition, boardId: BoardId, colour: PlayerColour): CastlingType {
  if (boardId === getCastlingRookBoardId(position, colour, CastlingType.CastlingKingSide)) return CastlingType.CastlingKingSide;
  if (boardId === getCastlingRookBoardId(position, colour, CastlingType.CastlingQueenSide)) return CastlingType.CastlingQueenSide;
  return CastlingType.NotCastling;
}
function clearCastlingAvailability(position: IBoardPosition, colour: PlayerColour, type: CastlingType) {
  if (colour === PlayerColour.White) {
    if (type !== CastlingType.CastlingQueenSide) position.castlingAvailability.whiteKingSide = false;
    if (type !== CastlingType.CastlingKingSide) position.castlingAvailability.whiteQueenSide = false;
    return;
  }
  if (type !== CastlingType.CastlingQueenSide) position.castlingAvailability.blackKingSide = false;
  if (type !== CastlingType.CastlingKingSide) position.castlingAvailability.blackQueenSide = false;
}
function _updateCastlingAvailability_(position: IBoardPosition, move: IMove, nextPosition: IBoardPosition) {
  const movingPiece = _getPiece(position, move.from)!;
  if (movingPiece.kind === PieceKind.King) clearCastlingAvailability(nextPosition, movingPiece.colour, CastlingType.NotCastling);
  else if (movingPiece.kind === PieceKind.Rook) {
    const castlingType = getCastlingSideForRook(position, move.from, movingPiece.colour);
    if (castlingType !== CastlingType.NotCastling) clearCastlingAvailability(nextPosition, movingPiece.colour, castlingType);
  }
  if (move.kind === MoveKind.EnPassant) return;
  const capturedPiece = _getPiece(position, move.to);
  if (capturedPiece?.kind === PieceKind.Rook) {
    const castlingType = getCastlingSideForRook(position, move.to, capturedPiece.colour);
    if (castlingType !== CastlingType.NotCastling) clearCastlingAvailability(nextPosition, capturedPiece.colour, castlingType);
  }
}
function _findCastleRook(position: IBoardPosition, from: BoardId, colour: PlayerColour, direction: number): BoardId | undefined {
  const castlingType = direction > 0 ? CastlingType.CastlingKingSide : CastlingType.CastlingQueenSide;
  const rookBoardId = getCastlingRookBoardId(position, colour, castlingType);
  if (rookBoardId == null) return;
  const kingPos = boardIdToCoords(from);
  const rookPos = boardIdToCoords(rookBoardId);
  const rook = _getPiece(position, rookBoardId);
  if (rookPos.rank !== kingPos.rank || Math.sign(rookPos.file - kingPos.file) !== direction) return;
  return rook?.colour === colour && rook.kind === PieceKind.Rook ? rookBoardId : undefined;
}
function _isCastlePathClear(position: IBoardPosition, from: BoardId, rookBoardId: BoardId, direction: number): boolean {
  const kingPos = boardIdToCoords(from);
  const rookFile = boardIdToCoords(rookBoardId).file;
  for (let file = kingPos.file + direction; file !== rookFile; file += direction) {
    if (isOccupied(position, coordsToBoardId(file, kingPos.rank))) return false;
  }
  return true;
}
function _isCastleKingPathSafe(position: IBoardPosition, from: BoardId, rookBoardId: BoardId, attackMask: number[], direction: number): boolean {
  const kingPos = boardIdToCoords(from);
  for (let step = 1; step <= 2; step += 1) {
    const to = tryCoordsToBoardId(kingPos.file + (direction * step), kingPos.rank);
    if (to === undefined || to !== rookBoardId && isOccupied(position, to)) return false;
    if (attackMask[to]) return false;
  }
  return true;
}
function _hasCastlingAvailability(position: IBoardPosition, colour: PlayerColour, direction: number): boolean {
  if (colour === PlayerColour.White) return direction > 0 ? position.castlingAvailability.whiteKingSide : position.castlingAvailability.whiteQueenSide;
  return direction > 0 ? position.castlingAvailability.blackKingSide : position.castlingAvailability.blackQueenSide;
}
// generate king moves that are possible to move to without being attacked
function _genKingMoves(position: IBoardPosition, from: BoardId, colour: PlayerColour, attackMask: number[]): IMoveRaw[] {
  const opponentColour = getOpponentColour(colour);
  const moves = _genOffsetMoves(from, kingOffsets).filter(move => {
    const targetPiece = _getPiece(position, move.to);
    if (targetPiece?.colour === opponentColour && targetPiece.kind === PieceKind.King
      || targetPiece?.colour == colour
    ) return false;
    return !attackMask[move.to];
  });
  const kingPos = boardIdToCoords(from);
  const homeRank = colour === PlayerColour.White ? 0 : 7;
  if (attackMask[from] || kingPos.rank !== homeRank) return moves;
  for (const direction of [-1, 1]) {
    if (!_hasCastlingAvailability(position, colour, direction)) continue;
    const rookBoardId = _findCastleRook(position, from, colour, direction);
    if (rookBoardId == null || !_isCastlePathClear(position, from, rookBoardId, direction)) continue;
    if (!_isCastleKingPathSafe(position, from, rookBoardId, attackMask, direction)) continue;
    moves.push({ from, to: coordsToBoardId(kingPos.file + (direction * 2), kingPos.rank) });
  }
  return moves;
}
// generate mask such that sliding attacks xray through the king so that squares behind the king is still masked and not allow the king to move into such squares
function _genKingMoveAttackState(position: IBoardPosition, kingBoardId: BoardId, attackerColour: PlayerColour): IKingAttackState {
  const king = _getPiece(position, kingBoardId);
  position.board[kingBoardId] = undefined;
  const attackState = genSquareAttackMask(position, attackerColour, kingBoardId);
  position.board[kingBoardId] = king;
  return attackState;
}
function _isSquareBetween(target: BoardId, from: BoardId, to: BoardId): boolean {
  const targetPos = boardIdToCoords(target);
  const fromPos = boardIdToCoords(from);
  const toPos = boardIdToCoords(to);
  const lineFile = toPos.file - fromPos.file;
  const lineRank = toPos.rank - fromPos.rank;
  const targetFile = targetPos.file - fromPos.file;
  const targetRank = targetPos.rank - fromPos.rank;
  const isStraightOrDiagonal = lineFile === 0 || lineRank === 0 || Math.abs(lineFile) === Math.abs(lineRank);
  const isSameLine = (lineFile * targetRank) === (lineRank * targetFile);
  const targetDistance = (lineFile * targetFile) + (lineRank * targetRank);
  const lineDistance = (lineFile * lineFile) + (lineRank * lineRank);
  return isStraightOrDiagonal && isSameLine && targetDistance > 0 && targetDistance < lineDistance;
}
function _moveResolveKingCheck(position: IBoardPosition, move: IMoveRaw, checkingAttack: IMoveRaw, colour: PlayerColour): boolean {
  if (move.to === checkingAttack.from || _isSquareBetween(move.to, checkingAttack.from, checkingAttack.to)) return true;
  const movingPiece = _getPiece(position, move.from);
  if (movingPiece?.kind !== PieceKind.Pawn || position.enPassantTarget !== move.to) return false;
  const toCoords = boardIdToCoords(move.to);
  const captureBoardId = coordsToBoardId(toCoords.file, toCoords.rank - getForwardDirection(colour));
  return captureBoardId === checkingAttack.from;
}
function _moveLeaveKingInCheck(position: IBoardPosition, move: IMoveRaw, colour: PlayerColour, kingBoardId: BoardId): boolean {
  const movingPiece = _getPiece(position, move.from)!;
  const isEnPassant = movingPiece.kind === PieceKind.Pawn && position.enPassantTarget === move.to;
  const toCoords = boardIdToCoords(move.to);
  const captureBoardId = isEnPassant ? coordsToBoardId(toCoords.file, toCoords.rank - getForwardDirection(colour)) : move.to;
  const capturedPiece = _getPiece(position, captureBoardId);
  const targetPiece = _getPiece(position, move.to);
  position.board[move.from] = undefined;
  position.board[captureBoardId] = undefined;
  position.board[move.to] = movingPiece;
  const opponentColour = getOpponentColour(colour);
  const isChecked = _isAttackedByDirection(position, kingBoardId, opponentColour, bishopDirections, [PieceKind.Bishop, PieceKind.Queen])
    || _isAttackedByDirection(position, kingBoardId, opponentColour, rookDirections, [PieceKind.Rook, PieceKind.Queen]);
  position.board[move.from] = movingPiece;
  position.board[move.to] = targetPiece;
  if (captureBoardId !== move.to) position.board[captureBoardId] = capturedPiece;
  return isChecked;
}
function _getEnpassantCaptureCoord(movePiece: IChessPiece, move: IMoveRaw): BoardId {
  const { file, rank } = boardIdToCoords(move.to)
  return coordsToBoardId(file, rank - getForwardDirection(movePiece.colour));
}
function _getCapturePiece(position: IBoardPosition, move: IMoveRaw): { boardId: BoardId; piece: PieceKind } | undefined {
  const movePiece = _getPiece(position, move.from);
  const captureBoardId = movePiece?.kind === PieceKind.Pawn
    && position.enPassantTarget != null
    && move.to === position.enPassantTarget
    ? _getEnpassantCaptureCoord(movePiece, move)
    : move.to;
  const capturePiece = _getPiece(position, captureBoardId);
  return capturePiece ? { boardId: captureBoardId, piece: capturePiece.kind } : undefined;
}
function _filterLegalNonKingMoves(position: IBoardPosition, moves: IMoveRaw[], colour: PlayerColour, kingBoardId: BoardId, kingAttacks: IMoveRaw[]): IMoveRaw[] {
  const opponentColour = getOpponentColour(colour);
  // if king is checked, first filter moves that capture the checker or block the checking ray
  if (kingAttacks.length === 1) moves = moves.filter(move => _moveResolveKingCheck(position, move, kingAttacks[0]!, colour));
  // filter moves that result in king being checked, set undefined and then generate moves for directional chess pieces, and make the new direction chess piece attack mask, then restore the chess piece on the position
  moves = moves.filter(move => _getPiece(position, move.to)?.colour != colour && !_moveLeaveKingInCheck(position, move, colour, kingBoardId));
  // filter moves that capture enemy king
  return moves.filter(move => {
    const targetPiece = _getPiece(position, move.to);
    return targetPiece?.colour !== opponentColour || targetPiece.kind !== PieceKind.King;
  });
}
function _genLegalRawMoves(position: IBoardPosition, attackState?: IKingAttackState): IMoveRaw[] {
  const colour = position.sideToMove;
  const opponentColour = getOpponentColour(colour);
  const kingBoardId = findKingBoardId(position, colour);
  if (kingBoardId === undefined) return [];
  // gen king moves + castle moves that are legal to move to (squares not attacked and not move into checks)
  const { attackMask, kingAttacks } = attackState ?? _genKingMoveAttackState(position, kingBoardId, opponentColour);
  const kingMoves = _genKingMoves(position, kingBoardId, colour, attackMask);
  // if king is double checked, only king moves can resolve it
  if (kingAttacks.length > 1) return kingMoves;

  // continue getting other moves
  const legalNonKingMoves = _filterLegalNonKingMoves(position, _genPseudoLegalNonKingMoves(position, colour), colour, kingBoardId, kingAttacks);
  // if king is checked and has no moves return empty (check mate)
  return [...legalNonKingMoves, ...kingMoves];
}
function _calculateCheckState(position: IBoardPosition): CheckState | undefined {
  const kingBoardId = findKingBoardId(position, position.sideToMove);
  if (kingBoardId == null) return;
  const attackState = _genKingMoveAttackState(position, kingBoardId, getOpponentColour(position.sideToMove));
  if (!attackState.kingAttacks.length) return;
  return _genLegalRawMoves(position, attackState).length ? CheckState.Check : CheckState.Checkmate;
}
function _getMoveKind(position: IBoardPosition, move: IMoveRaw): MoveKind {
  const movingPiece = _getPiece(position, move.from);
  if (!movingPiece) throw new ReferenceError(`No piece found on ${move.from}.`);
  if (movingPiece.kind === PieceKind.Pawn && position.enPassantTarget === move.to) return MoveKind.EnPassant;
  if (movingPiece.kind === PieceKind.Pawn && boardIdToCoords(move.to).rank === getPromotionRank(movingPiece.colour)) return MoveKind.Promotion;
  if (movingPiece.kind === PieceKind.King && Math.abs(boardIdToCoords(move.to).file - boardIdToCoords(move.from).file) === 2) return MoveKind.Castle;
  return MoveKind.Normal;
}
function _isMoveEnpassantTarget(move: IMove)
{
  const fromCoords = boardIdToCoords(move.from);
  const toCoords = boardIdToCoords(move.to);
  return move.movingPiece === PieceKind.Pawn
    && Math.abs(toCoords.rank - fromCoords.rank) === 2;
}
function moveMatches(candidate: IMoveRaw, move: IMoveRaw): boolean {
  return candidate.from === move.from && candidate.to === move.to;
}
function _updatePositionAfterMove(position: IBoardPosition, move: IMove, movingPiece: IChessPiece, isCapture: boolean): IBoardPosition {
  const toCoords = boardIdToCoords(move.to);
  position.enPassantTarget = _isMoveEnpassantTarget(move)
    ? coordsToBoardId(toCoords.file, toCoords.rank - getForwardDirection(movingPiece.colour))
    : undefined;
  position.halfMoveClock = movingPiece.kind === PieceKind.Pawn || isCapture ? 0 : position.halfMoveClock + 1;
  position.fullMoveNumber = movingPiece.colour === PlayerColour.Black ? position.fullMoveNumber + 1 : position.fullMoveNumber;
  position.sideToMove = getOpponentColour(movingPiece.colour);
  position.$ = undefined;
  return position;
}
function _applyCastleMove(position: IBoardPosition, move: IMove, king: IChessPiece): IBoardPosition {
  const castlingType = getMoveCastlingType(move);
  const rookFrom = getCastlingRookBoardId(position, king.colour, castlingType) ?? throwReferenceError('No castling rook square found.');
  const rook = _getPiece(position, rookFrom);
  if (rook?.kind !== PieceKind.Rook || rook.colour !== king.colour) throwReferenceError('No eligible rook found for castling move.');
  const homeRank = king.colour === PlayerColour.White ? 0 : 7;
  const isKingSide = castlingType === CastlingType.CastlingKingSide;
  const kingTo = coordsToBoardId(isKingSide ? 6 : 2, homeRank);
  const rookTo = coordsToBoardId(isKingSide ? 5 : 3, homeRank);
  _updateCastlingAvailability_(position, move, position);
  position.board[move.from] = undefined;
  position.board[rookFrom] = undefined;
  position.board[kingTo] = king;
  position.board[rookTo] = rook;
  return _updatePositionAfterMove(position, move, king, false);
}

export function genLegalMovesForPiece(position: IBoardPosition, from: BoardId, lastMove?: IMove): IMoveRaw[] {
  const colour = position.sideToMove;
  const piece = _getPiece(position, from);
  if (piece?.colour !== colour) return [];
  const opponentColour = getOpponentColour(colour);
  const isCurrentLastMove = lastMove?.movingColour === opponentColour;
  if (isCurrentLastMove && lastMove.checkState === CheckState.Checkmate) return [];
  if (piece.kind === PieceKind.King) {
    const { attackMask } = _genKingMoveAttackState(position, from, opponentColour);
    return _genKingMoves(position, from, colour, attackMask);
  }
  const kingBoardId = findKingBoardId(position, colour);
  if (kingBoardId === undefined) return [];
  const kingAttacks = isCurrentLastMove && lastMove.checkState === undefined
    ? []
    : _genKingMoveAttackState(position, kingBoardId, opponentColour).kingAttacks;
  if (kingAttacks.length > 1) return [];
  return _filterLegalNonKingMoves(position, _genPieceMoves(position, from, piece), colour, kingBoardId, kingAttacks);
}
export function genLegalMoves(position: IBoardPosition) {
  const legalMoves = _genLegalRawMoves(position);
  return legalMoves.map(x => toDetailedMove(position, x, legalMoves));
}
export function isMoveLegal(position: IBoardPosition, move: IMoveRaw): boolean {
  const candidate = _genLegalRawMoves(position).find((item) => moveMatches(item, move));
  if (candidate === undefined) return false;
  if (_getMoveKind(position, candidate) === MoveKind.Promotion) return move.promotionPiece != null && promotionPieces.includes(move.promotionPiece);
  return move.promotionPiece === undefined;
}
export function requiresPromotionSelection(position: IBoardPosition, move: IMoveRaw): boolean {
  const piece = position.board[move.from] ?? throwReferenceError(`expecting a piece at position ${move.from}`);
  return piece.kind === PieceKind.Pawn
    && boardIdToCoords(move.to).rank === getPromotionRank(piece.colour)
    && move.promotionPiece === undefined;
}
/** Reads check state through `position.$`; the first lookup populates the runtime cache, including a no-check result. */
export function getCheckState(position: IBoardPosition): CheckState | undefined {
  if (position.$?.isCheckStateCached) return position.$.checkState;
  const checkState = _calculateCheckState(position);
  const runtime = position.$ ??= {};
  runtime.checkState = checkState;
  runtime.isCheckStateCached = true;
  return checkState;
}
export function genNextPosition(position: IBoardPosition, move: IMoveCandidate): IBoardPosition {
  const nextPosition = cloneBoardPosition(position);
  return applyMove(nextPosition, move);
}
export function toDetailedMove(position: IBoardPosition, move: IMoveRaw, legalMoves?: IMoveRaw[]): IMove {
  legalMoves = legalMoves ?? _genLegalRawMoves(position);
  const movingPiece = _getPiece(position, move.from)!;
  const kind = _getMoveKind(position, move);
  const capturePiece = kind === MoveKind.EnPassant ? PieceKind.Pawn : _getPiece(position, move.to)?.kind;
  const alternativeFrom = legalMoves.filter(lm =>
    move.from !== lm.from
    && move.to === lm.to
    && _getPiece(position, lm.from)?.kind === movingPiece.kind
  );
  const ambiguityKind = alternativeFrom.length > 0
    ?  alternativeFrom.every(af => boardIdToCoords(af.from).rank === boardIdToCoords(move.from).rank)
      ? AmbiguityKind.SameRankOnly
      : alternativeFrom.every(af => boardIdToCoords(af.from).file === boardIdToCoords(move.from).file)
        ? AmbiguityKind.SameFileOnly
        : AmbiguityKind.Both
    : undefined;
  const result: IMove = { ...move
    , movingColour: movingPiece.colour
    , movingPiece: movingPiece.kind
    , kind
    , capturePiece
    , ambiguityKind
  };
  result.checkState = getCheckState(genNextPosition(position, result));
  return result;
}
export function genDetailedMoves(position: IBoardPosition, rawMoves: readonly IMoveRaw[]): IMove[] {
  const moves: IMove[] = [];
  let simulatedPosition = cloneBoardPosition(position);
  for (const rawMove of rawMoves) {
    const legalMoves = _genLegalRawMoves(simulatedPosition);
    const move = toDetailedMove(simulatedPosition, rawMove, legalMoves);
    moves.push(move);
    simulatedPosition = applyMove(simulatedPosition, move);
  }
  return moves;
}
export function resolveGameResult(position: IBoardPosition): { resultState: ResultState; resultReason: ResultReason | undefined } {
  if (hasInsufficientMaterial(position)) return { resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved };
  const kingBoardId = findKingBoardId(position, position.sideToMove);
  if (kingBoardId === undefined) return { resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved };
  const attackState = _genKingMoveAttackState(position, kingBoardId, getOpponentColour(position.sideToMove));
  if (_genLegalRawMoves(position, attackState).length) return { resultState: ResultState.Ongoing, resultReason: undefined };
  if (!attackState.kingAttacks.length) return { resultState: ResultState.Drawn, resultReason: ResultReason.RuleResolved };
  return { resultState: position.sideToMove === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon, resultReason: ResultReason.RuleResolved };
}
export function createInitialBoardPosition(): IBoardPosition {
  return { board: [...standardInitialBoard], sideToMove: PlayerColour.White, castlingAvailability: { whiteKingSide: true, whiteQueenSide: true, blackKingSide: true, blackQueenSide: true }, halfMoveClock: 0, fullMoveNumber: 1, $: { isStandardInitialPosition: true } };
}
/** Reads standard-root identity through `position.$`, populating the derived runtime cache on first lookup. */
export function isStandardInitialPosition(position: IBoardPosition): boolean {
  if (position.$?.isStandardInitialPosition != null) return position.$.isStandardInitialPosition;
  function _computeIsStandardInitialPosition(position: IBoardPosition): boolean {
    if (position.board.length !== 64 || position.sideToMove !== PlayerColour.White || position.enPassantTarget != null || position.halfMoveClock !== 0 || position.fullMoveNumber !== 1) return false;
    const castling = position.castlingAvailability;
    if (!castling.whiteKingSide || !castling.whiteQueenSide || !castling.blackKingSide || !castling.blackQueenSide) return false;
    if (position.castlingRook) return false;
    return position.board.every((piece, boardId) => {
      const initialPiece = standardInitialBoard[boardId];
      return piece?.colour === initialPiece?.colour && piece?.kind === initialPiece?.kind;
    });
  }
  const isStandard = _computeIsStandardInitialPosition(position);
  (position.$ ??= {}).isStandardInitialPosition = isStandard;
  return isStandard;
}
export function applyMove(position: IBoardPosition, move: IMove): IBoardPosition
{
  const movingPiece = _getPiece(position, move.from);
  if (!movingPiece) throw new ReferenceError(`No piece found on ${move.from}.`);
  if (move.kind === MoveKind.Castle) return _applyCastleMove(position, move, movingPiece);
  const captureMeta = _getCapturePiece(position, move);
  _updateCastlingAvailability_(position, move, position);
  position.board[captureMeta?.boardId ?? move.to] = undefined;
  if (move.kind === MoveKind.Promotion)
  {
    if (!move.promotionPiece) throw new ReferenceError(`Promotion piece must be specified for promotion move from ${move.from} to ${move.to}.`);
    position.board[move.to] = { kind: move.promotionPiece, colour: movingPiece.colour }
  }
  else position.board[move.to] = movingPiece;
  position.board[move.from] = undefined;
  return _updatePositionAfterMove(position, move, movingPiece, !!captureMeta);
}
