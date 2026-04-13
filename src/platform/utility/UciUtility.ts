import { MoveKind, PieceKind, PlayerColour, type IAnalysisLine, type IBoardPosition, type IEnginePositionState, type IEngineRegistrationRequest, type IMove } from '@/contracts';
import { GameRuleService } from '@/domain';

function pieceToFenToken(kind: PieceKind, colour: PlayerColour): string {
  const token = kind === PieceKind.King ? 'k' : kind === PieceKind.Queen ? 'q' : kind === PieceKind.Rook ? 'r' : kind === PieceKind.Bishop ? 'b' : kind === PieceKind.Knight ? 'n' : 'p';
  return colour === PlayerColour.White ? token.toUpperCase() : token;
}
export function boardIdToNotation(boardId: number): string {
  const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
  return `${fileNames[boardId % 8]}${Math.floor(boardId / 8) + 1}`;
}
function buildFenBoard(position: IBoardPosition): string {
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
      tokens += pieceToFenToken(piece.kind, piece.colour);
    }
    ranks.push(emptyCount > 0 ? `${tokens}${emptyCount}` : tokens);
  }
  return ranks.join('/');
}
export function buildFen(position: IBoardPosition): string {
  const castling = [position.castlingAvailability.whiteKingSide ? 'K' : '', position.castlingAvailability.whiteQueenSide ? 'Q' : '', position.castlingAvailability.blackKingSide ? 'k' : '', position.castlingAvailability.blackQueenSide ? 'q' : ''].join('') || '-';
  const enPassant = position.enPassantTarget === null ? '-' : boardIdToNotation(position.enPassantTarget);
  const sideToMove = position.sideToMove === PlayerColour.White ? 'w' : 'b';
  return `${buildFenBoard(position)} ${sideToMove} ${castling} ${enPassant} ${position.halfMoveClock} ${position.fullMoveNumber}`;
}
export function buildUciMove(move: IMove): string {
  const promotionToken = move.promotionPiece === PieceKind.Queen ? 'q' : move.promotionPiece === PieceKind.Rook ? 'r' : move.promotionPiece === PieceKind.Bishop ? 'b' : move.promotionPiece === PieceKind.Knight ? 'n' : '';
  return `${boardIdToNotation(move.from)}${boardIdToNotation(move.to)}${promotionToken}`;
}
export function buildPositionCommand(positionState: IEnginePositionState): string {
  const moves = positionState.movesFromRoot.map((move) => buildUciMove(move));
  if (moves.length === 0) return `position fen ${buildFen(positionState.rootPosition)}`;
  return `position fen ${buildFen(positionState.rootPosition)} moves ${moves.join(' ')}`;
}
function parsePromotionPiece(token: string | undefined): PieceKind | null {
  if (token === 'q') return PieceKind.Queen;
  if (token === 'r') return PieceKind.Rook;
  if (token === 'b') return PieceKind.Bishop;
  if (token === 'n') return PieceKind.Knight;
  return null;
}
export function parseUciMove(position: IBoardPosition, raw: string): IMove {
  const uci = raw.trim().toLowerCase();
  const legalMoves = GameRuleService.generateLegalMoves(position);
  for (const candidate of legalMoves) {
    const candidatePrefix = `${boardIdToNotation(candidate.from)}${boardIdToNotation(candidate.to)}`;
    if (!uci.startsWith(candidatePrefix)) continue;
    if (candidate.kind !== MoveKind.Promotion) return { ...candidate, promotionPiece: null };
    return { ...candidate, promotionPiece: parsePromotionPiece(uci[4]) ?? PieceKind.Queen };
  }
  throw new Error(`Engine move is not legal in the current position: ${raw}.`);
}
function applyPv(position: IBoardPosition, rawMoves: string[]): IMove[] {
  const moves: IMove[] = [];
  let currentPosition = structuredClone(position);
  for (const rawMove of rawMoves) {
    const move = parseUciMove(currentPosition, rawMove);
    moves.push(move);
    currentPosition = GameRuleService.applyMove(currentPosition, move);
  }
  return moves;
}
function findTokenValue(tokens: string[], label: string): string | null {
  const index = tokens.indexOf(label);
  return index < 0 || index + 1 >= tokens.length ? null : tokens[index + 1]!;
}
export function parseInfoLine(position: IBoardPosition, line: string): { multiPv: number; analysisLine: IAnalysisLine } | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info' || !tokens.includes('pv') || !tokens.includes('depth') || !tokens.includes('score')) return null;
  const depth = Number.parseInt(findTokenValue(tokens, 'depth') ?? '', 10);
  if (!Number.isInteger(depth)) return null;
  const scoreIndex = tokens.indexOf('score');
  const scoreKind = tokens[scoreIndex + 1];
  const scoreValue = Number.parseInt(tokens[scoreIndex + 2] ?? '', 10);
  const pvIndex = tokens.indexOf('pv');
  const multiPv = Number.parseInt(findTokenValue(tokens, 'multipv') ?? '1', 10);
  if (scoreKind === undefined || pvIndex < 0 || Number.isNaN(scoreValue)) return null;
  return {
    multiPv: Number.isInteger(multiPv) && multiPv > 0 ? multiPv : 1,
    analysisLine: { depth, scoreCp: scoreKind === 'cp' ? scoreValue : null, scoreMate: scoreKind === 'mate' ? scoreValue : null, pv: applyPv(position, tokens.slice(pvIndex + 1)) },
  };
}
export function parseBestMoveLine(position: IBoardPosition, line: string): IMove | null | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove' || tokens[1] === undefined) return undefined;
  if (tokens[1] === '(none)') return null;
  return parseUciMove(position, tokens[1]);
}
export function buildRegistrationCommand(request: IEngineRegistrationRequest): string {
  if (request.registerLater) return 'register later';
  const namePart = request.name === null ? '' : ` name ${request.name}`;
  const codePart = request.code === null ? '' : ` code ${request.code}`;
  return `register${namePart}${codePart}`;
}
