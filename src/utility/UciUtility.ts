import { EngineOptionType, MoveKind, PieceKind, PlayerColour, type BoardId, type IAnalysisLine, type IBoardPosition, type IEngineOptionMeta, type IEnginePositionState, type IMove } from '@/contracts';
import { boardIdToCoords, coordsToBoardId, getForwardDirection, getPawnHomeRank } from '@/utility/chess/SquareUtility';

// #region Public methods

export function boardIdToNotation(boardId: number): string {
  const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
  return `${fileNames[boardId % 8]}${Math.floor(boardId / 8) + 1}`;
}
export function buildFen(position: IBoardPosition): string {
  const castling = [position.castlingAvailability.whiteKingSide ? 'K' : '', position.castlingAvailability.whiteQueenSide ? 'Q' : '', position.castlingAvailability.blackKingSide ? 'k' : '', position.castlingAvailability.blackQueenSide ? 'q' : ''].join('') || '-';
  const enPassant = position.enPassantTarget === undefined ? '-' : boardIdToNotation(position.enPassantTarget);
  const sideToMove = position.sideToMove === PlayerColour.White ? 'w' : 'b';
  return `${_buildFenBoard(position)} ${sideToMove} ${castling} ${enPassant} ${position.halfMoveClock} ${position.fullMoveNumber}`;
}
export function buildPositionCommand(positionState: IEnginePositionState): string {
  const moves = positionState.movesFromRoot.map((move) => buildUciMove(move));
  if (moves.length === 0) return `position fen ${buildFen(positionState.rootPosition)}`;
  return `position fen ${buildFen(positionState.rootPosition)} moves ${moves.join(' ')}`;
}
export function buildRegisterCommand(): string {
  return 'register later';
}
export function buildUciMove(move: IMove): string {
  const promotionToken = move.promotionPiece === PieceKind.Queen ? 'q' : move.promotionPiece === PieceKind.Rook ? 'r' : move.promotionPiece === PieceKind.Bishop ? 'b' : move.promotionPiece === PieceKind.Knight ? 'n' : '';
  return `${boardIdToNotation(move.from)}${boardIdToNotation(move.to)}${promotionToken}`;
}
export function parseBestMoveLine(line: string, colour: PlayerColour, enPassantTarget?: BoardId): IMove | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove' || !tokens[1] || tokens[1] === '(none)') return;
  return parseUciMove(tokens[1], colour, enPassantTarget);
}
export function parseInfoLine(line: string, colour: PlayerColour, enPassantTarget?: BoardId): IAnalysisLine | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info' || !tokens.includes('pv') || !tokens.includes('depth') || !tokens.includes('score')) return;
  const depth = Number.parseInt(_findTokenValue(tokens, 'depth') ?? '', 10);
  if (!Number.isInteger(depth)) return;
  const scoreIndex = tokens.indexOf('score');
  const scoreKind = tokens[scoreIndex + 1];
  const scoreValue = Number.parseInt(tokens[scoreIndex + 2] ?? '', 10);
  const pvIndex = tokens.indexOf('pv');
  const reference = Number.parseInt(_findTokenValue(tokens, 'multipv') ?? '1', 10);
  if (scoreKind === undefined || pvIndex < 0 || Number.isNaN(scoreValue)) return;
  return {
    depth,
    scoreCp: scoreKind === 'cp' ? scoreValue : undefined,
    scoreMate: scoreKind === 'mate' ? scoreValue : undefined,
    pv: _parsePv(tokens.slice(pvIndex + 1), colour, enPassantTarget),
    $: { reference: Number.isInteger(reference) && reference > 0 ? reference : 1 },
  };
}
export function parseOptionLines(lines: readonly string[]): IEngineOptionMeta[] {
  const options: IEngineOptionMeta[] = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.split(/\s+/, 1)[0] !== 'option') continue;
    options.push(_parseOptionLine(trimmedLine));
  }
  return options;
}
export function parseUciMove(raw: string, colour: PlayerColour, enPassantTarget?: BoardId): IMove {
  const uci = raw.trim().toLowerCase();
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) throw new Error(`Invalid UCI move notation: ${raw}.`);
  const from = _parseBoardId(match[1]!);
  const to = _parseBoardId(match[2]!);
  const promotionPiece = _parsePromotionPiece(match[3]);
  const kind = promotionPiece !== undefined
    ? MoveKind.Promotion
    : _isCastlingMove(from, to, colour)
      ? MoveKind.Castle
      : _isEnPassantMove(from, to, colour, enPassantTarget)
        ? MoveKind.EnPassant
        : MoveKind.Normal;
  return { from, to, kind, movingColour: colour, promotionPiece, $: { uci } };
}

// #endregion

// #region Private methods

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
      tokens += _pieceToFenToken(piece.kind, piece.colour);
    }
    ranks.push(emptyCount > 0 ? `${tokens}${emptyCount}` : tokens);
  }
  return ranks.join('/');
}
function _findTokenValue(tokens: string[], label: string): string | undefined {
  const index = tokens.indexOf(label);
  return index < 0 || index + 1 >= tokens.length ? undefined : tokens[index + 1]!;
}
function _getNextEnPassantTarget(move: IMove): BoardId | undefined {
  if (move.kind !== MoveKind.Normal) return;
  const from = boardIdToCoords(move.from);
  const to = boardIdToCoords(move.to);
  const direction = getForwardDirection(move.movingColour);
  if (from.file !== to.file || from.rank !== getPawnHomeRank(move.movingColour) || to.rank - from.rank !== direction * 2) return;
  return coordsToBoardId(from.file, from.rank + direction);
}
function _getOptionFieldValues(tokens: string[], fieldName: string): string[][] {
  const fieldNames = new Set(['default', 'min', 'max', 'var']);
  const values: string[][] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== fieldName) continue;
    let endIndex = index + 1;
    while (endIndex < tokens.length && !fieldNames.has(tokens[endIndex]!)) endIndex += 1;
    values.push(tokens.slice(index + 1, endIndex));
  }
  return values;
}
function _isCastlingMove(from: BoardId, to: BoardId, colour: PlayerColour): boolean {
  const homeRank = colour === PlayerColour.White ? 0 : 7;
  const fromCoords = boardIdToCoords(from);
  const toCoords = boardIdToCoords(to);
  return fromCoords.file === 4 && fromCoords.rank === homeRank && toCoords.rank === homeRank && (toCoords.file === 2 || toCoords.file === 6);
}
function _isEnPassantMove(from: BoardId, to: BoardId, colour: PlayerColour, enPassantTarget?: BoardId): boolean {
  if (enPassantTarget !== to) return false;
  const fromCoords = boardIdToCoords(from);
  const toCoords = boardIdToCoords(to);
  return Math.abs(toCoords.file - fromCoords.file) === 1 && toCoords.rank - fromCoords.rank === getForwardDirection(colour);
}
function _parseBoardId(notation: string): BoardId {
  const file = notation.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number.parseInt(notation[1]!, 10) - 1;
  const boardId = coordsToBoardId(file, rank);
  if (boardId !== undefined) return boardId;
  throw new Error(`Invalid UCI square notation: ${notation}.`);
}
function _parseOptionDefault(type: EngineOptionType, tokens: string[]): string | number | boolean | undefined {
  const valueTokens = _getOptionFieldValues(tokens, 'default')[0];
  if (valueTokens === undefined || type === EngineOptionType.Action) return;
  const value = valueTokens.join(' ');
  if (type === EngineOptionType.Boolean) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Invalid UCI boolean option default: ${value}.`);
  }
  if (type === EngineOptionType.Integer) return _parseOptionInteger(value, 'default');
  return value === '<empty>' ? '' : value;
}
function _parseOptionInteger(value: string, fieldName: string): number {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isInteger(parsedValue) && parsedValue.toString() === value) return parsedValue;
  throw new Error(`Invalid UCI integer option ${fieldName}: ${value}.`);
}
function _parseOptionLine(line: string): IEngineOptionMeta {
  const tokens = line.split(/\s+/);
  const typeIndex = tokens.indexOf('type', 2);
  if (tokens[0] !== 'option' || tokens[1] !== 'name' || typeIndex < 3 || !tokens[typeIndex + 1]) throw new Error(`Invalid UCI option line: ${line}.`);
  const name = tokens.slice(2, typeIndex).join(' ');
  const type = _parseOptionType(tokens[typeIndex + 1]!);
  const fieldTokens = tokens.slice(typeIndex + 2);
  const minimumValue = _getOptionFieldValues(fieldTokens, 'min')[0]?.join(' ');
  const maximumValue = _getOptionFieldValues(fieldTokens, 'max')[0]?.join(' ');
  const choices = type === EngineOptionType.Choice ? _getOptionFieldValues(fieldTokens, 'var').map((value) => value.join(' ')) : undefined;
  const defaultValue = _parseOptionDefault(type, fieldTokens);
  const option: IEngineOptionMeta = { name, type };
  if (defaultValue !== undefined) option.defaultValue = defaultValue;
  if (minimumValue !== undefined) option.minimum = _parseOptionInteger(minimumValue, 'minimum');
  if (maximumValue !== undefined) option.maximum = _parseOptionInteger(maximumValue, 'maximum');
  if (choices !== undefined) option.choices = choices;
  return option;
}
function _parseOptionType(type: string): EngineOptionType {
  if (type === 'button') return EngineOptionType.Action;
  if (type === 'check') return EngineOptionType.Boolean;
  if (type === 'combo') return EngineOptionType.Choice;
  if (type === 'spin') return EngineOptionType.Integer;
  if (type === 'string') return EngineOptionType.Text;
  throw new Error(`Unsupported UCI option type: ${type}.`);
}
function _parsePromotionPiece(token: string | undefined): PieceKind | undefined {
  if (token === 'q') return PieceKind.Queen;
  if (token === 'r') return PieceKind.Rook;
  if (token === 'b') return PieceKind.Bishop;
  if (token === 'n') return PieceKind.Knight;
  return;
}
function _parsePv(rawMoves: string[], colour: PlayerColour, enPassantTarget?: BoardId): IMove[] {
  const moves: IMove[] = [];
  let currentColour = colour;
  let currentEnPassantTarget = enPassantTarget;
  for (const rawMove of rawMoves) {
    const move = parseUciMove(rawMove, currentColour, currentEnPassantTarget);
    moves.push(move);
    currentEnPassantTarget = _getNextEnPassantTarget(move);
    currentColour = currentColour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White;
  }
  return moves;
}
function _pieceToFenToken(kind: PieceKind, colour: PlayerColour): string {
  const token = kind === PieceKind.King ? 'k' : kind === PieceKind.Queen ? 'q' : kind === PieceKind.Rook ? 'r' : kind === PieceKind.Bishop ? 'b' : kind === PieceKind.Knight ? 'n' : 'p';
  return colour === PlayerColour.White ? token.toUpperCase() : token;
}

// #endregion
