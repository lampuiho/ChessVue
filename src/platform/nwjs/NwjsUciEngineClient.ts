import { defineStore } from 'pinia';

import { EngineAnalysisSearchMode, MoveKind, PieceKind, PlayerColour, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisRequest, type IEnginePositionState, type IEngineRegistrationRequest, type IMove, type IPlatformError } from '@/contracts';
import { GameRuleService, PositionIdentityService } from '@/domain';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

import type { IEngineAnalysisUpdate, IEngineClient, ProcessHandle } from '../contracts';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';

interface IDeferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}
interface ILineWaiter {
  predicate(line: string): boolean;
  resolve(line: string): void;
  reject(error: unknown): void;
}
interface IUciSession {
  initialised: boolean;
  isStopping: boolean;
  process: ISpawnedProcess | null;
  lineBuffer: string;
  positionState: IEnginePositionState | null;
  analysisCallback: ((update: IEngineAnalysisUpdate) => void) | null;
  analysisLines: Map<number, IAnalysisLine>;
  playerMoveDeferred: IDeferred<IMove> | null;
  waiters: ILineWaiter[];
  detachProcessListeners: (() => void) | null;
}
interface IAssignedUciEngineRuntime extends IAssignedEngineRuntime {
  session: IUciSession;
}
type IRuntimeAssignedEngine = IAssignedEngine & {
  $: IAssignedEngineRuntime;
};
type IAssignedUciEngine = IAssignedEngine & {
  $: IAssignedUciEngineRuntime;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
function pieceToFenToken(kind: PieceKind, colour: PlayerColour): string {
  const token = kind === PieceKind.King ? 'k' : kind === PieceKind.Queen ? 'q' : kind === PieceKind.Rook ? 'r' : kind === PieceKind.Bishop ? 'b' : kind === PieceKind.Knight ? 'n' : 'p';
  return colour === PlayerColour.White ? token.toUpperCase() : token;
}
function boardIdToNotation(boardId: number): string {
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
function buildFen(position: IBoardPosition): string {
  const castling = [position.castlingAvailability.whiteKingSide ? 'K' : '', position.castlingAvailability.whiteQueenSide ? 'Q' : '', position.castlingAvailability.blackKingSide ? 'k' : '', position.castlingAvailability.blackQueenSide ? 'q' : ''].join('') || '-';
  const enPassant = position.enPassantTarget === null ? '-' : boardIdToNotation(position.enPassantTarget);
  const sideToMove = position.sideToMove === PlayerColour.White ? 'w' : 'b';
  return `${buildFenBoard(position)} ${sideToMove} ${castling} ${enPassant} ${position.halfMoveClock} ${position.fullMoveNumber}`;
}
function buildUciMove(move: IMove): string {
  const promotionToken = move.promotionPiece === PieceKind.Queen ? 'q' : move.promotionPiece === PieceKind.Rook ? 'r' : move.promotionPiece === PieceKind.Bishop ? 'b' : move.promotionPiece === PieceKind.Knight ? 'n' : '';
  return `${boardIdToNotation(move.from)}${boardIdToNotation(move.to)}${promotionToken}`;
}
function buildPositionCommand(positionState: IEnginePositionState): string {
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
function parseUciMove(position: IBoardPosition, raw: string): IMove {
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
function parseInfoLine(position: IBoardPosition, line: string): { multiPv: number; analysisLine: IAnalysisLine } | null {
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
function parseBestMoveLine(position: IBoardPosition, line: string): IMove | null | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove' || tokens[1] === undefined) return undefined;
  if (tokens[1] === '(none)') return null;
  return parseUciMove(position, tokens[1]);
}
function buildRegistrationCommand(request: IEngineRegistrationRequest): string {
  if (request.registerLater) return 'register later';
  const namePart = request.name === null ? '' : ` name ${request.name}`;
  const codePart = request.code === null ? '' : ` code ${request.code}`;
  return `register${namePart}${codePart}`;
}
function createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail: string | null = null): IPlatformError {
  return { kind, operation, message, detail };
}
function createSession(): IUciSession {
  return {
    initialised: false,
    isStopping: false,
    process: null,
    lineBuffer: '',
    positionState: null,
    analysisCallback: null,
    analysisLines: new Map(),
    playerMoveDeferred: null,
    waiters: [],
    detachProcessListeners: null,
  };
}
function isRuntimeAssignedUciEngine(engine: IAssignedEngine): engine is IAssignedUciEngine {
  return engine.$ !== undefined && 'session' in engine.$;
}
function hasRuntimeAssignedEngine(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return engine.$ !== undefined;
}
function requireRuntimeAssignedEngine(engine: IAssignedEngine): IRuntimeAssignedEngine {
  if (hasRuntimeAssignedEngine(engine)) return engine;
  throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine runtime is not available for ${engine.displayName}.`);
}
function requireRuntimeAssignedUciEngine(engine: IAssignedEngine): IAssignedUciEngine {
  if (isRuntimeAssignedUciEngine(engine)) return engine;
  throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine runtime is not available for ${engine.displayName}.`);
}
function _ensureAssignedEngineInitialised(engine: IAssignedEngine): IAssignedUciEngine {
  if (isRuntimeAssignedUciEngine(engine)) return engine;
  const runtimeState: IAssignedUciEngineRuntime = { ...requireRuntimeAssignedEngine(engine).$, session: createSession() };
  engine.$ = runtimeState;
  if (isRuntimeAssignedUciEngine(engine)) return engine;
  throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Failed to initialise engine runtime for ${engine.displayName}.`);
}
export function defineNwjsUciEngineClientStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  return defineStore('nwjsUciEngineClient', () => {
    async function initialiseEngine(engine: IAssignedEngine): Promise<void> {
      const session = _requireSession(_ensureAssignedEngineInitialised(engine));
      if (session.initialised) return;
      const processHandle = _requireProcessHandle(engine);
      _attachToProcess(engine, processHandle);
      await _writeCommandAndWait(session, processHandle, 'uci', (line) => line === 'uciok');
      for (const [optionName, value] of Object.entries(engine.options)) await _writeCommand(processHandle, `setoption name ${optionName} value ${String(value)}`);
      await _writeCommandAndWait(session, processHandle, 'isready', (line) => line === 'readyok');
      session.initialised = true;
    }
    async function registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
      await initialiseEngine(engine);
      await _writeCommand(_requireProcessHandle(engine), buildRegistrationCommand(request));
    }
    async function syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
      await initialiseEngine(engine);
      const session = _requireSession(engine);
      const processHandle = _requireProcessHandle(engine);
      if (session.positionState === null || requiresNewGameBoundary(positionState)) {
        await _writeCommand(processHandle, 'ucinewgame');
        await _writeCommandAndWait(session, processHandle, 'isready', (line) => line === 'readyok');
      }
      session.positionState = structuredClone(positionState);
      await _writeCommand(processHandle, buildPositionCommand(positionState));
    }
    async function startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void> {
      if (request.searchMode !== EngineAnalysisSearchMode.Infinite) throw new Error(`Unsupported engine search mode: ${request.searchMode}.`);
      await initialiseEngine(engine);
      const session = _requireSession(engine);
      session.analysisCallback = onUpdate;
      session.analysisLines.clear();
      await _writeCommand(_requireProcessHandle(engine), `setoption name MultiPV value ${request.multiPv}`);
      await _writeCommand(_requireProcessHandle(engine), 'go infinite');
    }
    async function stopAnalysis(engine: IAssignedEngine): Promise<void> {
      await _writeCommand(_requireProcessHandle(engine), 'stop');
    }
    async function startPlayerTurn(engine: IAssignedEngine): Promise<void> {
      await initialiseEngine(engine);
      const session = _requireSession(engine);
      session.playerMoveDeferred = createDeferred<IMove>();
      await _writeCommand(_requireProcessHandle(engine), 'go');
    }
    async function awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
      const session = _requireSession(engine);
      if (session.playerMoveDeferred === null) throw new Error(`No player turn is active for engine ${engine.displayName}.`);
      const movePromise = session.playerMoveDeferred.promise;
      session.playerMoveDeferred = null;
      return movePromise;
    }
    async function stopEngine(engine: IAssignedEngine): Promise<void> {
      const session = _requireSession(_ensureAssignedEngineInitialised(engine));
      session.isStopping = true;
      session.initialised = false;
      session.positionState = null;
      session.analysisCallback = null;
      session.analysisLines.clear();
      session.waiters.splice(0).forEach((waiter) => waiter.reject(new Error('Engine stopped.')));
      session.playerMoveDeferred?.reject(new Error('Engine stopped.'));
      session.playerMoveDeferred = null;
      session.lineBuffer = '';
      _detachProcess(session);
      session.process = null;
      session.isStopping = false;
    }
    async function restartEngine(engine: IAssignedEngine): Promise<void> {
      await stopEngine(engine);
      await initialiseEngine(engine);
    }
    function requiresNewGameBoundary(positionState: IEnginePositionState): boolean {
      return positionState.requiresNewGameBoundary;
    }
    function _attachToProcess(engine: IAssignedEngine, processHandle: ProcessHandle): void {
      const runtimeState = requireRuntimeAssignedUciEngine(engine).$;
      const session = runtimeState.session;
      if (runtimeState.processHandle !== processHandle) throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine process is not available for ${engine.displayName}.`);
      const process = _requireProcess(processHandle);
      if (session.process === process && session.detachProcessListeners !== null) return;
      if (session.detachProcessListeners !== null) _detachProcess(session);
      session.process = process;
      if (session.detachProcessListeners !== null) return;
      const onStdoutData = (chunk: string | Buffer) => _consumeChunk(session, chunk.toString());
      const onStderrData = (chunk: string | Buffer) => _consumeChunk(session, chunk.toString());
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        session.detachProcessListeners = null;
        session.process = null;
        if (session.isStopping) return;
        const error = createPlatformError(PlatformErrorKind.UnexpectedExit, 'engineClient', `Engine exited unexpectedly for ${engine.displayName}.`, `code=${code ?? 'null'} signal=${signal ?? 'null'}`);
        session.initialised = false;
        session.positionState = null;
        session.waiters.splice(0).forEach((waiter) => waiter.reject(error));
        session.playerMoveDeferred?.reject(error);
        session.playerMoveDeferred = null;
        session.analysisCallback = null;
        session.analysisLines.clear();
      };
      process.stdout?.on('data', onStdoutData);
      process.stderr?.on('data', onStderrData);
      process.once('exit', onExit);
      session.detachProcessListeners = () => {
        process.stdout?.removeListener('data', onStdoutData);
        process.stderr?.removeListener('data', onStderrData);
        process.removeListener('exit', onExit);
      };
    }
    function _detachProcess(session: IUciSession): void {
      session.detachProcessListeners?.();
      session.detachProcessListeners = null;
    }
    function _consumeChunk(session: IUciSession, chunk: string): void {
      session.lineBuffer += chunk;
      const lines = session.lineBuffer.split(/\r?\n/);
      session.lineBuffer = lines.pop() ?? '';
      for (const line of lines) _consumeLine(session, line.trim());
    }
    function _consumeLine(session: IUciSession, line: string): void {
      if (line.length === 0) return;
      const waiterIndex = session.waiters.findIndex((waiter) => waiter.predicate(line));
      if (waiterIndex >= 0) {
        const [waiter] = session.waiters.splice(waiterIndex, 1);
        waiter!.resolve(line);
        return;
      }
      if (session.positionState !== null && session.analysisCallback !== null) {
        const parsedInfo = parseInfoLine(session.positionState.currentPosition, line);
        if (parsedInfo !== null) {
          session.analysisLines.set(parsedInfo.multiPv, parsedInfo.analysisLine);
          session.analysisCallback(_buildAnalysisUpdate(session.positionState, session.analysisLines, false, undefined));
          return;
        }
        const analysisBestMove = parseBestMoveLine(session.positionState.currentPosition, line);
        if (analysisBestMove !== undefined) {
          session.analysisCallback(_buildAnalysisUpdate(session.positionState, session.analysisLines, true, analysisBestMove));
          session.analysisCallback = null;
          return;
        }
      }
      if (session.positionState !== null && session.playerMoveDeferred !== null) {
        const bestMove = parseBestMoveLine(session.positionState.currentPosition, line);
        if (bestMove !== undefined && bestMove !== null) session.playerMoveDeferred.resolve(bestMove);
      }
    }
    function _buildAnalysisUpdate(positionState: IEnginePositionState, analysisLines: Map<number, IAnalysisLine>, isFinal: boolean, bestMove: IMove | null | undefined): IEngineAnalysisUpdate {
      const lines = [...analysisLines.entries()].sort((left, right) => left[0] - right[0]).map(([, line]) => line);
      return { position: structuredClone(positionState.currentPosition), positionKey: PositionIdentityService.buildPositionKey(positionState.currentPosition), bestMove: bestMove ?? lines[0]?.pv[0] ?? null, lines, isFinal };
    }
    function _waitForLine(session: IUciSession, predicate: (line: string) => boolean): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        session.waiters.push({ predicate, resolve, reject });
      });
    }
    async function _writeCommandAndWait(session: IUciSession, processHandle: ProcessHandle, command: string, predicate: (line: string) => boolean): Promise<string> {
      const linePromise = _waitForLine(session, predicate);
      await _writeCommand(processHandle, command);
      return linePromise;
    }
    async function _writeCommand(processHandle: ProcessHandle | null, command: string): Promise<void> {
      const process = _requireProcess(processHandle);
      if (process.stdin === null) throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine stdin is unavailable for process ${processHandle}.`);
      process.stdin.write(`${command}\n`);
    }
    function _requireProcessHandle(engine: IAssignedEngine): ProcessHandle {
      const processHandle = requireRuntimeAssignedUciEngine(engine).$.processHandle;
      if (processHandle === null) throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine process is not available for ${engine.displayName}.`);
      return processHandle;
    }
    function _requireProcess(processHandle: ProcessHandle | null): ISpawnedProcess {
      if (processHandle === null) throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', 'Engine process handle is unavailable.');
      const process = processRegistry.get(processHandle);
      if (process !== undefined) return process;
      throw createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine process is not available for handle ${processHandle}.`);
    }
    function _requireSession(engine: IAssignedEngine): IUciSession {
      return requireRuntimeAssignedUciEngine(engine).$.session;
    }

    return { initialiseEngine, registerEngine, syncPosition, startAnalysis, stopAnalysis, startPlayerTurn, awaitPlayerTurnMove, stopEngine, restartEngine, requiresNewGameBoundary } satisfies IEngineClient;
  });
}
