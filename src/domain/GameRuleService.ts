import { CheckState, MoveKind, PieceKind, PlayerColour, ResultReason, ResultState, type BoardId, type IBoardPosition, type IMove } from '@/contracts';
import { findKingBoardId, getOpponentColour } from '@/utility/chess/BoardUtility';
import { boardIdToCoords, coordsToBoardId, getPromotionRank, getForwardDirection } from '@/utility/chess/SquareUtility';
import {
  generatePseudoLegalMoves,
  getPiece,
  hasInsufficientMaterial,
  isSquareAttacked,
  moveMatches,
  promotionPieces,
} from '@/utility/chess/GameRuleUtility';

const enum CastlingType {
  NotCastling,
  CastlingKingSide,
  CastlingQueenSide,
}
const standardInitialBackRank = [PieceKind.Rook, PieceKind.Knight, PieceKind.Bishop, PieceKind.Queen, PieceKind.King, PieceKind.Bishop, PieceKind.Knight, PieceKind.Rook] as const;
function _getMoveCastlingType(boardId: BoardId): CastlingType {
  if (boardId === 7 || boardId === 63) return CastlingType.CastlingKingSide;
  if (boardId === 0 || boardId === 56) return CastlingType.CastlingQueenSide;
  return CastlingType.NotCastling;
}
function _isStandardInitialSquare(position: IBoardPosition, boardId: BoardId): boolean {
  const piece = position.board[boardId];
  const rank = Math.floor(boardId / 8);
  if (rank > 1 && rank < 6) return piece === undefined;
  const colour = rank < 2 ? PlayerColour.White : PlayerColour.Black;
  if (rank === 1 || rank === 6) return piece?.colour === colour && piece.kind === PieceKind.Pawn;
  return piece?.colour === colour && piece.kind === standardInitialBackRank[boardId % 8];
}
function _cloneBoard(board: IBoardPosition['board']): IBoardPosition['board'] {
  return board.map((piece) => piece === undefined ? undefined : { ...piece });
}
function _cloneBoardPosition(position: IBoardPosition): IBoardPosition {
  return {
    board: _cloneBoard(position.board),
    sideToMove: position.sideToMove,
    castlingAvailability: { ...position.castlingAvailability },
    enPassantTarget: position.enPassantTarget,
    halfMoveClock: position.halfMoveClock,
    fullMoveNumber: position.fullMoveNumber,
    checkState: position.checkState,
  };
}
function _clearCastlingAvailability(position: IBoardPosition, colour: PlayerColour, type: CastlingType): void {
  if (colour === PlayerColour.White) {
    if (type === CastlingType.CastlingKingSide) position.castlingAvailability.whiteKingSide = false;
    else if (type === CastlingType.CastlingQueenSide) position.castlingAvailability.whiteQueenSide = false;
    else {
      position.castlingAvailability.whiteKingSide = false;
      position.castlingAvailability.whiteQueenSide = false;
    }
    return;
  }
  if (type === CastlingType.CastlingKingSide) position.castlingAvailability.blackKingSide = false;
  else if (type === CastlingType.CastlingQueenSide) position.castlingAvailability.blackQueenSide = false;
  else {
    position.castlingAvailability.blackKingSide = false;
    position.castlingAvailability.blackQueenSide = false;
  }
}
function _updateCastlingAvailability(position: IBoardPosition, move: IMove, nextPosition: IBoardPosition): void {
  const movingPiece = getPiece(position, move.from);
  if (!movingPiece) throw new ReferenceError(`No piece found on ${move.from}.`);
  if (movingPiece.kind === PieceKind.King) _clearCastlingAvailability(nextPosition, movingPiece.colour, CastlingType.NotCastling);
  else if (movingPiece.kind === PieceKind.Rook) {
    const movedRookCastlingType = _getMoveCastlingType(move.from);
    if (movedRookCastlingType !== CastlingType.NotCastling) _clearCastlingAvailability(nextPosition, movingPiece.colour, movedRookCastlingType);
  }
  if (move.kind === MoveKind.EnPassant) return;
  const capturedPiece = getPiece(position, move.to);
  if (capturedPiece?.kind !== PieceKind.Rook) return;
  const capturedRookCastlingType = _getMoveCastlingType(move.to);
  if (capturedRookCastlingType !== CastlingType.NotCastling) _clearCastlingAvailability(nextPosition, capturedPiece.colour, capturedRookCastlingType);
}
function _createCandidateMovePosition(position: IBoardPosition, move: IMove): IBoardPosition {
  const movingPiece = getPiece(position, move.from);
  if (!movingPiece) throw new ReferenceError(`No piece found on ${move.from}.`);
  if (move.kind === MoveKind.Promotion && !move.promotionPiece) throw new Error('Promotion piece selection is required before applying a promotion move.');
  const nextPosition = _cloneBoardPosition(position);
  nextPosition.board[move.from] = undefined;
  let isCapture = !!getPiece(position, move.to);
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
  _updateCastlingAvailability(position, move, nextPosition);
  nextPosition.enPassantTarget = undefined;
  const fromCoords = boardIdToCoords(move.from);
  const toCoords = boardIdToCoords(move.to);
  if (movingPiece.kind === PieceKind.Pawn && Math.abs(toCoords.rank - fromCoords.rank) === 2) nextPosition.enPassantTarget = coordsToBoardId(fromCoords.file, fromCoords.rank + getForwardDirection(movingPiece.colour));
  nextPosition.halfMoveClock = movingPiece.kind === PieceKind.Pawn || isCapture ? 0 : position.halfMoveClock + 1;
  nextPosition.fullMoveNumber = movingPiece.colour === PlayerColour.Black ? position.fullMoveNumber + 1 : position.fullMoveNumber;
  nextPosition.sideToMove = getOpponentColour(movingPiece.colour);
  return nextPosition;
}
function createDefaultCastlingAvailability(): IBoardPosition['castlingAvailability'] {
  return {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  };
}
function getCheckState(position: IBoardPosition): CheckState {
  const kingBoardId = findKingBoardId(position, position.sideToMove);
  if (kingBoardId === undefined) return CheckState.None;
  const isInCheck = isSquareAttacked(position, kingBoardId, getOpponentColour(position.sideToMove));
  if (!isInCheck) return CheckState.None;
  const hasLegalMoves = generatePseudoLegalMoves(position, position.sideToMove)
    .some((candidate) => GameRuleService.isMoveLegal(position, candidate));
  if (position.sideToMove === PlayerColour.White) return hasLegalMoves ? CheckState.CheckWhite : CheckState.CheckmateWhite;
  return hasLegalMoves ? CheckState.CheckBlack : CheckState.CheckmateBlack;
}
function isMoveLegal(position: IBoardPosition, move: IMove): boolean {
  const movingPiece = getPiece(position, move.from);
  if (move.movingColour !== position.sideToMove || movingPiece === undefined || movingPiece.colour !== move.movingColour) return false;
  const promotionResolvedMoves = move.kind === MoveKind.Promotion && move.promotionPiece === undefined
    ? promotionPieces.map((piece) => ({ ...move, promotionPiece: piece }))
    : [move];
  return promotionResolvedMoves.some((resolvedMove) => {
    //TODO: this is so expensive there has to be simpler way to check
    const nextPosition = _createCandidateMovePosition(position, resolvedMove);
    return !isSquareAttacked(nextPosition, findKingBoardId(nextPosition, move.movingColour)!, getOpponentColour(move.movingColour));
  });
}
function generateLegalMoves(position: IBoardPosition): IMove[] {
  return generatePseudoLegalMoves(position, position.sideToMove)
    .filter((candidate) => isMoveLegal(position, candidate));
}
function requiresPromotionSelection(position: IBoardPosition, move: IMove): boolean {
  const piece = getPiece(position, move.from);
  if (piece?.kind !== PieceKind.Pawn) return false;
  return boardIdToCoords(move.to).rank === getPromotionRank(piece.colour) && move.promotionPiece === undefined;
}
function applyMove(position: IBoardPosition, move: IMove): IBoardPosition {
  const legalMoves = generateLegalMoves(position);
  const matchingMove = legalMoves.find((candidate) => moveMatches(candidate, move));
  if (!matchingMove) throw new Error('Cannot apply an illegal move.');
  if (requiresPromotionSelection(position, move)) throw new Error('Promotion piece selection is required before applying a promotion move.');
  const nextPosition = _createCandidateMovePosition(position, {
    from: matchingMove.from,
    to: matchingMove.to,
    kind: matchingMove.kind,
    movingColour: matchingMove.movingColour,
    promotionPiece: move.promotionPiece,
  });
  nextPosition.checkState = getCheckState(nextPosition);
  return nextPosition;
}
function resolveResult(position: IBoardPosition): { resultState: ResultState; resultReason: ResultReason | undefined; } {
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
function createInitialBoardPosition(): IBoardPosition {
  const board: IBoardPosition['board'] = Array(64).fill(undefined);
  for (let file = 0; file < 8; file += 1) {
    const whitePawnBoardId = coordsToBoardId(file, 1);
    const blackPawnBoardId = coordsToBoardId(file, 6);
    if (whitePawnBoardId !== undefined) board[whitePawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.White };
    if (blackPawnBoardId !== undefined) board[blackPawnBoardId] = { kind: PieceKind.Pawn, colour: PlayerColour.Black };
  }
  board[0] = { kind: PieceKind.Rook, colour: PlayerColour.White };
  board[1] = { kind: PieceKind.Knight, colour: PlayerColour.White };
  board[2] = { kind: PieceKind.Bishop, colour: PlayerColour.White };
  board[3] = { kind: PieceKind.Queen, colour: PlayerColour.White };
  board[4] = { kind: PieceKind.King, colour: PlayerColour.White };
  board[5] = { kind: PieceKind.Bishop, colour: PlayerColour.White };
  board[6] = { kind: PieceKind.Knight, colour: PlayerColour.White };
  board[7] = { kind: PieceKind.Rook, colour: PlayerColour.White };
  board[56] = { kind: PieceKind.Rook, colour: PlayerColour.Black };
  board[57] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  board[58] = { kind: PieceKind.Bishop, colour: PlayerColour.Black };
  board[59] = { kind: PieceKind.Queen, colour: PlayerColour.Black };
  board[60] = { kind: PieceKind.King, colour: PlayerColour.Black };
  board[61] = { kind: PieceKind.Bishop, colour: PlayerColour.Black };
  board[62] = { kind: PieceKind.Knight, colour: PlayerColour.Black };
  board[63] = { kind: PieceKind.Rook, colour: PlayerColour.Black };
  return {
    board,
    sideToMove: PlayerColour.White,
    castlingAvailability: createDefaultCastlingAvailability(),
    halfMoveClock: 0,
    fullMoveNumber: 1,
    checkState: CheckState.None,
    $: { isStandardInitialPosition: true },
  };
}
function isStandardInitialPosition(position: IBoardPosition): boolean {
  const castling = position.castlingAvailability;
  if (position.board.length !== 64 || position.sideToMove !== PlayerColour.White || position.enPassantTarget !== undefined) return false;
  if (position.halfMoveClock !== 0 || position.fullMoveNumber !== 1 || position.checkState !== CheckState.None) return false;
  if (!castling.whiteKingSide || !castling.whiteQueenSide || !castling.blackKingSide || !castling.blackQueenSide) return false;
  return position.board.every((_piece, boardId) => _isStandardInitialSquare(position, boardId));
}

export const GameRuleService = {
  createInitialBoardPosition,
  generateLegalMoves,
  isMoveLegal,
  requiresPromotionSelection,
  applyMove,
  getCheckState,
  isStandardInitialPosition,
  resolveResult,
};
