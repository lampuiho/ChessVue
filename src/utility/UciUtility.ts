import { EngineOptionType, PieceKind, type BoardId, type IBoardPosition, type IEngineOptionMeta, type IGame, type IMove, type IMoveRaw } from '@/contracts';
import { isStandardInitialPosition } from '@/utility/chess/GameRuleUtility';
import { buildFen, getUci } from '@/utility/chess/MoveNotationUtility';
import { coordsToBoardId } from '@/utility/chess/SquareUtility';

export interface IUciBestMove {
  move: IMoveRaw;
  ponderMove?: IMoveRaw;
}
export interface IUciAnalysisLine {
  depth: number;
  scoreCp?: number;
  scoreMate?: number;
  pv: IMoveRaw[];
  reference: number;
}

// #region Public methods

export function boardIdToNotation(boardId: number): string {
  const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
  return `${fileNames[boardId % 8]}${Math.floor(boardId / 8) + 1}`;
}
export function buildAnalysisCommands(game: IGame): string[] {
  return [buildPositionCommand(game), 'go infinite'];
}
export function buildDebugCommand(enabled: boolean): string {
  return `debug ${enabled ? 'on' : 'off'}`;
}
export function buildFindNextMoveCommands(game: IGame, expectedPonderMove?: IMove): string[] {
  const liveMoves = _getLiveMoves(game);
  if (expectedPonderMove !== undefined) return _movesMatch(liveMoves[liveMoves.length - 1], expectedPonderMove) ? ['ponderhit'] : ['stop'];
  return [_buildPositionCommand(game.rootPosition, liveMoves), _buildTimedGoCommand(game)];
}
export function buildIsReadyCommand(): string {
  return 'isready';
}
export function buildPonderMoveCommands(game: IGame, ponderMove: IMove): string[] {
  return [_buildPositionCommand(game.rootPosition, [..._getLiveMoves(game), ponderMove]), _buildTimedGoCommand(game, true)];
}
/** Builds the UCI position command from the game root and highlighted path, caching standard-root verification under the position's runtime metadata. */
export function buildPositionCommand(game: IGame): string {
  return _buildPositionCommand(game.rootPosition, _getMovesFromPath(game, game.renderedPath));
}
export function buildQuitCommand(): string {
  return 'quit';
}
export function buildRegisterCommand(): string {
  return 'register later';
}
export function buildSetOptionCommand(name: string, value?: string | number | boolean): string {
  if (name.trim().length === 0) throw new Error('UCI option name is required.');
  if (value === undefined) return `setoption name ${name}`;
  return `setoption name ${name} value ${String(value)}`;
}
export function buildStopCommand(): string {
  return 'stop';
}
export function buildUciCommand(): string {
  return 'uci';
}
export function buildUciMove(move: IMoveRaw): string {
  return getUci(move);
}
export function buildUciNewGameCommand(): string {
  return 'ucinewgame';
}
export function parseBestMoveLine(line: string): IUciBestMove | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove' || !tokens[1] || tokens[1] === '(none)') return;
  const move = parseUciMove(tokens[1]);
  if (tokens[2] === undefined) return { move };
  if (tokens[2] !== 'ponder' || !tokens[3]) throw new Error(`Invalid UCI bestmove line: ${line}.`);
  return { move, ponderMove: parseUciMove(tokens[3]) };
}
export function parseInfoLine(line: string): IUciAnalysisLine | undefined {
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
    pv: _parsePv(tokens.slice(pvIndex + 1)),
    reference: Number.isInteger(reference) && reference > 0 ? reference : 1,
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
export function parseUciMove(raw: string): IMoveRaw {
  const uci = raw.trim().toLowerCase();
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) throw new Error(`Invalid UCI move notation: ${raw}.`);
  const from = _parseBoardId(match[1]!);
  const to = _parseBoardId(match[2]!);
  const promotionPiece = _parsePromotionPiece(match[3]);
  return { from, to, promotionPiece, $: { uci } };
}

// #endregion

// #region Private methods

function _buildPositionCommand(rootPosition: IBoardPosition, moves: readonly IMove[]): string {
  const position = `position ${_buildRootPosition(rootPosition)}`;
  if (moves.length === 0) return position;
  return `${position} moves ${moves.map((move) => buildUciMove(move)).join(' ')}`;
}
function _buildRootPosition(rootPosition: IBoardPosition): string {
  return isStandardInitialPosition(rootPosition) ? 'startpos' : `fen ${buildFen(rootPosition)}`;
}
function _buildTimedGoCommand(game: IGame, ponder: boolean = false): string {
  const whiteTime = game.clockSnapshot.white.remainingMs;
  const blackTime = game.clockSnapshot.black.remainingMs;
  if (whiteTime === undefined || blackTime === undefined) throw new Error(`Timed engine search requires both clocks for game ${game.metadata.id}.`);
  const tokens = ['go'];
  if (ponder) tokens.push('ponder');
  tokens.push('wtime', whiteTime.toString(), 'btime', blackTime.toString());
  if (game.timeControl.incrementMs > 0) tokens.push('winc', game.timeControl.incrementMs.toString(), 'binc', game.timeControl.incrementMs.toString());
  return tokens.join(' ');
}
function _findTokenValue(tokens: string[], label: string): string | undefined {
  const index = tokens.indexOf(label);
  return index < 0 || index + 1 >= tokens.length ? undefined : tokens[index + 1]!;
}
function _getLiveMoves(game: IGame): IMove[] {
  if (game.livePath === undefined) throw new Error(`Live move path is unavailable for game ${game.metadata.id}.`);
  return _getMovesFromPath(game, game.livePath);
}
function _getMovesFromPath(game: IGame, path: readonly number[]): IMove[] {
  const moves: IMove[] = [];
  let node = game.moveTree.root;
  for (const childIndex of path) {
    const child = node.children[childIndex];
    if (!child?.move) throw new Error(`Highlighted move path is invalid for game ${game.metadata.id}.`);
    moves.push(child.move);
    node = child;
  }
  return moves;
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
function _movesMatch(left: IMove | undefined, right: IMove): boolean {
  return left !== undefined && left.from === right.from && left.to === right.to && left.promotionPiece === right.promotionPiece;
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
function _parsePv(rawMoves: string[]): IMoveRaw[] {
  return rawMoves.map((move) => parseUciMove(move));
}

// #endregion
