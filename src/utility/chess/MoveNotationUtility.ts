import { AmbiguityKind, CheckState, MoveKind, PieceKind, PlayerColour, type IBoardPosition, type IMove, type IMoveRaw, type BoardId } from '@/contracts';
import { boardIdToCoords } from './SquareUtility';

const _fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

function _boardIdToNotation(boardId: BoardId): string {
  const { file, rank } = boardIdToCoords(boardId);
  return `${_fileNames[file]}${rank + 1}`;
}
function _pieceSymbol(kind: PieceKind): string {
  return kind === PieceKind.Pawn ? '' : getPieceLetter(kind);
}
function _buildFenBoard(position: IBoardPosition): string {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let emptyCount = 0;
    let tokens = '';
    for (let file = 0; file < 8; file += 1) {
      const piece = position.board[(rank * 8) + file];
      if (piece === undefined) {
        emptyCount += 1;
        continue;
      }
      if (emptyCount > 0) {
        tokens += emptyCount.toString();
        emptyCount = 0;
      }
      const letter = getPieceLetter(piece.kind);
      tokens += piece.colour === PlayerColour.White ? letter : letter.toLowerCase();
    }
    ranks.push(emptyCount > 0 ? `${tokens}${emptyCount}` : tokens);
  }
  return ranks.join('/');
}
function _buildFenValue(position: IBoardPosition): string {
  const castling = [
    position.castlingAvailability.whiteKingSide ? 'K' : '',
    position.castlingAvailability.whiteQueenSide ? 'Q' : '',
    position.castlingAvailability.blackKingSide ? 'k' : '',
    position.castlingAvailability.blackQueenSide ? 'q' : '',
  ].join('') || '-';
  const enPassant = position.enPassantTarget === undefined ? '-' : _boardIdToNotation(position.enPassantTarget);
  const sideToMove = position.sideToMove === PlayerColour.White ? 'w' : 'b';
  return `${_buildFenBoard(position)} ${sideToMove} ${castling} ${enPassant} ${position.halfMoveClock} ${position.fullMoveNumber}`;
}
function _getDisambiguation(move: IMove): string {
  switch (move.ambiguityKind) {
    case AmbiguityKind.SameRankOnly:
      return _boardIdToNotation(move.from)[0]!;
    case AmbiguityKind.SameFileOnly:
      return _boardIdToNotation(move.from)[1]!;
    case AmbiguityKind.Both:
      return _boardIdToNotation(move.from);
    default:
      return '';
  }
}
function _buildSan(move: IMove): string {
  const checkSuffix = move.checkState === CheckState.Checkmate ? '#' : move.checkState === CheckState.Check ? '+' : '';
  if (move.kind === MoveKind.Castle) return `${boardIdToCoords(move.to).file === 6 ? 'O-O' : 'O-O-O'}${checkSuffix}`;
  const capture = move.capturePiece;
  const pawnCapturePrefix = move.movingPiece === PieceKind.Pawn && capture ? _boardIdToNotation(move.from)[0]! : '';
  const promotion = move.promotionPiece === undefined ? '' : `=${_pieceSymbol(move.promotionPiece)}`;
  return `${_pieceSymbol(move.movingPiece)}${pawnCapturePrefix}${_getDisambiguation(move)}${capture ? 'x' : ''}${_boardIdToNotation(move.to)}${promotion}${checkSuffix}`;
}
/** the uppercase FEN/SAN letter for a piece kind; lowercase it for a black piece in FEN */
export function getPieceLetter(kind: PieceKind): string {
  if (kind === PieceKind.King) return 'K';
  if (kind === PieceKind.Queen) return 'Q';
  if (kind === PieceKind.Rook) return 'R';
  if (kind === PieceKind.Bishop) return 'B';
  if (kind === PieceKind.Knight) return 'N';
  return 'P';
}
/** Returns FEN through a read-through `position.$` cache so protocol consumers do not rebuild it repeatedly. */
export function buildFen(position: IBoardPosition): string {
  if (position.$?.fen) return position.$.fen;
  const fen = _buildFenValue(position);
  (position.$ ??= {}).fen = fen;
  return fen;
}
/** Returns SAN through a read-through `move.$` cache shared by notation consumers. */
export function getSan(move: IMove): string {
  if (move.$?.san) return move.$.san;
  const san = _buildSan(move);
  (move.$ ??= {}).san = san;
  return san;
}
/** Returns UCI notation through a read-through `move.$` cache shared by protocol consumers. */
export function getUci(move: IMoveRaw): string {
  if (move.$?.uci) return move.$.uci;
  const promotion = move.promotionPiece === PieceKind.Queen ? 'q' : move.promotionPiece === PieceKind.Rook ? 'r' : move.promotionPiece === PieceKind.Bishop ? 'b' : move.promotionPiece === PieceKind.Knight ? 'n' : '';
  const uci = `${_boardIdToNotation(move.from)}${_boardIdToNotation(move.to)}${promotion}`;
  (move.$ ??= {}).uci = uci;
  return uci;
}
