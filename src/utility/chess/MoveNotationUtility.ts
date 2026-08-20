import { AmbiguityKind, CheckState, MoveKind, PieceKind, type IMove, type IMoveRaw, type BoardId } from '@/contracts';
import { boardIdToCoords } from './SquareUtility';

const _fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

function boardIdToNotation_(boardId: BoardId): string {
  const { file, rank } = boardIdToCoords(boardId);
  return `${_fileNames[file]}${rank + 1}`;
}
function pieceSymbol(kind: PieceKind): string {
  if (kind === PieceKind.King) return 'K';
  if (kind === PieceKind.Queen) return 'Q';
  if (kind === PieceKind.Rook) return 'R';
  if (kind === PieceKind.Bishop) return 'B';
  if (kind === PieceKind.Knight) return 'N';
  return '';
}
function getDisambiguation(move: IMove): string {
  switch (move.ambiguityKind) {
    case AmbiguityKind.SameRankOnly:
      return boardIdToNotation_(move.from)[0]!;
    case AmbiguityKind.SameFileOnly:
      return boardIdToNotation_(move.from)[1]!;
    case AmbiguityKind.Both:
      return boardIdToNotation_(move.from);
    default:
      return '';
  }
}
function buildSan(move: IMove): string {
  const checkSuffix = move.checkState === CheckState.Checkmate ? '#' : move.checkState === CheckState.Check ? '+' : '';
  if (move.kind === MoveKind.Castle) return `${boardIdToCoords(move.to).file === 6 ? 'O-O' : 'O-O-O'}${checkSuffix}`;
  const capture = move.capturePiece !== undefined;
  const pawnCapturePrefix = move.movingPiece === PieceKind.Pawn && capture ? boardIdToNotation_(move.from)[0]! : '';
  const promotion = move.promotionPiece === undefined ? '' : `=${pieceSymbol(move.promotionPiece)}`;
  return `${pieceSymbol(move.movingPiece)}${pawnCapturePrefix}${getDisambiguation(move)}${capture ? 'x' : ''}${boardIdToNotation_(move.to)}${promotion}${checkSuffix}`;
}
export function getSan(move: IMove): string {
  if (move.$?.san !== undefined) return move.$.san;
  const san = buildSan(move);
  (move.$ ??= {}).san = san;
  return san;
}
export function getUci(move: IMoveRaw): string {
  if (move.$?.uci !== undefined) return move.$.uci;
  const promotion = move.promotionPiece === PieceKind.Queen ? 'q' : move.promotionPiece === PieceKind.Rook ? 'r' : move.promotionPiece === PieceKind.Bishop ? 'b' : move.promotionPiece === PieceKind.Knight ? 'n' : '';
  const uci = `${boardIdToNotation_(move.from)}${boardIdToNotation_(move.to)}${promotion}`;
  (move.$ ??= {}).uci = uci;
  return uci;
}
