import { defineStore } from 'pinia';

import { EngineAnalysisSearchMode, EngineClientType, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisRequest, type IEngineOptionMeta, type IGame, type IMove, type IPlatformError } from '@/contracts';
import type { IEngineAnalysisUpdate, IEngineClient, ProcessHandle } from '@/contracts/platform';
import { Deferred } from '@/utility/async/Deferred';
import { buildPositionKey } from '@/utility/chess';
import { genDetailedMoves } from '@/utility/chess/GameRuleUtility';
import { buildFen } from '@/utility/chess/MoveNotationUtility';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';
import { buildAnalysisCommands, buildFindNextMoveCommands, buildIsReadyCommand, buildPonderMoveCommands, buildRegisterCommand, buildSetOptionCommand, buildStopCommand, buildUciCommand, buildUciNewGameCommand, parseBestMoveLine, parseInfoLine, parseOptionLines } from '../../utility/UciUtility';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';
import { attachProcessLineListeners, writeProcessLine } from './NwjsProcessLineUtility';

const enum UciSessionState {
  Created = 'created',
  AwaitingUciOk = 'awaitingUciOk',
  AwaitingReadyOk = 'awaitingReadyOk',
  Ready = 'ready',
  Analysing = 'analysing',
  FindingMove = 'findingMove',
  Pondering = 'pondering',
  StoppingAnalysis = 'stoppingAnalysis',
  StoppingPonder = 'stoppingPonder',
  Stopped = 'stopped',
  Failed = 'failed',
}
interface IUciSession {
  state: UciSessionState;
  gameId?: string;
  optionLines: string[];
  options: IEngineOptionMeta[];
  position?: IBoardPosition;
  process?: ISpawnedProcess;
  rootFen?: string;
  expectedPonderMove?: IMove;
  playerMoveDeferred?: Deferred<IMove>;
  stateDeferred?: Deferred<void>;
  detachProcessListeners?: () => void;
}
interface IAssignedUciEngineRuntime extends IAssignedEngineRuntime {
  session?: IUciSession;
}
type IAssignedUciEngine = IAssignedEngine & {
  clientType: EngineClientType.Uci;
  $?: IAssignedUciEngineRuntime;
};
type IRuntimeAssignedEngine = IAssignedEngine & {
  $: IAssignedEngineRuntime;
};
type IRuntimeAssignedUciEngine = IAssignedUciEngine & {
  $: IAssignedUciEngineRuntime;
};

function _createInvalidProcessHandleError(message: string, detail?: string): IPlatformError {
  return _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'engineClient', message, detail);
}
function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
function _createUciSession(): IUciSession {
  return { state: UciSessionState.Created, optionLines: [], options: [] };
}
function _failUciSession(session: IUciSession, error: unknown): void {
  session.state = UciSessionState.Failed;
  session.gameId = undefined;
  session.position = undefined;
  session.rootFen = undefined;
  session.expectedPonderMove = undefined;
  session.optionLines = [];
  session.options = [];
  session.stateDeferred?.reject(error);
  session.stateDeferred = undefined;
  session.playerMoveDeferred?.reject(error);
  session.playerMoveDeferred = undefined;
  session.detachProcessListeners?.();
  session.detachProcessListeners = undefined;
  session.process = undefined;
}
function _initialiseAssignedEngineSession(engine: IAssignedEngine): IUciSession {
  const assignedUciEngine = _requireAssignedUciEngine(engine);
  const runtimeEngine = _requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
  if (runtimeEngine.$.session) return runtimeEngine.$.session;
  runtimeEngine.$.session = _createUciSession();
  return runtimeEngine.$.session;
}
function _isAssignedEngineUci(engine: IAssignedEngine): engine is IAssignedUciEngine {
  return engine.clientType === EngineClientType.Uci;
}
function _isInitialisedState(state: UciSessionState): boolean {
  return state === UciSessionState.Ready || state === UciSessionState.Analysing || state === UciSessionState.FindingMove || state === UciSessionState.Pondering || state === UciSessionState.StoppingAnalysis || state === UciSessionState.StoppingPonder;
}
function _isRuntimeAssignedEngine(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
  return !!engine.$;
}
function _requireAssignedUciEngine(engine: IAssignedEngine): IAssignedUciEngine {
  if (_isAssignedEngineUci(engine)) return engine;
  throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', 'Engine client type is not UCI.');
}
function _requireRuntimeAssignedEngine(engine: IAssignedEngine): IRuntimeAssignedEngine {
  if (_isRuntimeAssignedEngine(engine)) return engine;
  throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine runtime is not available for ${engine.displayName}.`);
}
function _resetUciSession(session: IUciSession): void {
  session.state = UciSessionState.Created;
  session.gameId = undefined;
  session.position = undefined;
  session.rootFen = undefined;
  session.expectedPonderMove = undefined;
  session.optionLines = [];
  session.options = [];
  session.stateDeferred = undefined;
  session.playerMoveDeferred = undefined;
}
function _stopUciSession(session: IUciSession, message = 'Engine stopped.'): void {
  const error = new Error(message);
  session.state = UciSessionState.Stopped;
  session.gameId = undefined;
  session.position = undefined;
  session.rootFen = undefined;
  session.expectedPonderMove = undefined;
  session.optionLines = [];
  session.options = [];
  session.stateDeferred?.reject(error);
  session.stateDeferred = undefined;
  session.playerMoveDeferred?.reject(error);
  session.playerMoveDeferred = undefined;
  session.detachProcessListeners?.();
  session.detachProcessListeners = undefined;
  session.process = undefined;
}

export function defineNwjsUciEngineClientStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  return defineStore('nwjsUciEngineClient', () => {
    // #region Public methods

    async function awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
      const session = _requireInitialisedSession(engine);
      const deferred = session.playerMoveDeferred;
      if (!deferred) throw new Error(`No player turn is active for engine ${engine.displayName}.`);
      try {
        return await deferred;
      } finally {
        if (session.playerMoveDeferred === deferred) session.playerMoveDeferred = undefined;
      }
    }
    function getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[] {
      return _requireInitialisedSession(engine).options;
    }
    async function initialiseEngine(engine: IAssignedEngine): Promise<void> {
      const processHandle = _requireProcessHandle(engine);
      const process = _requireProcess(processHandle);
      const session = _initialiseAssignedEngineSession(engine);
      if (_isInitialisedState(session.state) && session.process === process) return;
      if (_isInitialisedState(session.state)) _stopUciSession(session, 'Engine process was replaced.');
      if (session.state === UciSessionState.Failed || session.state === UciSessionState.Stopped) _resetUciSession(session);
      if (session.state !== UciSessionState.Created) throw _createStateError(session, 'initialise engine');
      _attachToProcess(engine, processHandle, session);
      try {
        session.state = UciSessionState.AwaitingUciOk;
        session.state = await _writeCommandAndAwaitState(session, processHandle, buildUciCommand(), UciSessionState.Created);
        session.options = parseOptionLines(session.optionLines);
        session.optionLines = [];
        for (const [optionName, value] of Object.entries(engine.options)) await _writeCommand(processHandle, buildSetOptionCommand(optionName, value));
        session.state = UciSessionState.AwaitingReadyOk;
        session.state = await _writeCommandAndAwaitState(session, processHandle, buildIsReadyCommand(), UciSessionState.Ready);
      } catch (error) {
        if (session.state !== UciSessionState.Failed) _failUciSession(session, error);
        throw error;
      }
    }
    async function restartEngine(engine: IAssignedEngine): Promise<void> {
      await stopEngine(engine);
      await initialiseEngine(engine);
    }
    async function startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void> {
      if (request.searchMode !== EngineAnalysisSearchMode.Infinite) throw new Error(`Unsupported engine search mode: ${request.searchMode}.`);
      const session = _requireInitialisedSession(engine);
      if (session.state === UciSessionState.Analysing) await _stopSearch(engine, session, UciSessionState.StoppingAnalysis);
      _requireState(session, UciSessionState.Ready, 'start analysis');
      await _prepareGameBoundary(engine, session, game);
      const runtimeState = _requireRuntimeState(engine);
      runtimeState.analysisCallback = onUpdate;
      runtimeState.analysisLines.clear();
      session.position = _requireRenderedPosition(game);
      await _writeCommand(_requireProcessHandle(engine), buildSetOptionCommand('MultiPV', request.multiPv));
      await _startSearch(engine, session, UciSessionState.Analysing, buildAnalysisCommands(game));
    }
    async function startPlayerTurn(engine: IAssignedEngine, game: IGame): Promise<void> {
      const session = _requireInitialisedSession(engine);
      if (session.state === UciSessionState.Pondering) {
        const expectedPonderMove = session.expectedPonderMove;
        if (!expectedPonderMove) throw new Error(`Expected ponder move is unavailable for engine ${engine.displayName}.`);
        const ponderCommands = buildFindNextMoveCommands(game, expectedPonderMove);
        if (ponderCommands[0] === 'ponderhit') {
          session.expectedPonderMove = undefined;
          session.position = _requireLivePosition(game);
          session.playerMoveDeferred = new Deferred<IMove>();
          await _startSearch(engine, session, UciSessionState.FindingMove, ponderCommands);
          return;
        }
        await _stopSearch(engine, session, UciSessionState.StoppingPonder, ponderCommands[0]);
      }
      _requireState(session, UciSessionState.Ready, 'start player turn');
      await _prepareGameBoundary(engine, session, game);
      session.expectedPonderMove = undefined;
      session.position = _requireLivePosition(game);
      session.playerMoveDeferred = new Deferred<IMove>();
      await _startSearch(engine, session, UciSessionState.FindingMove, buildFindNextMoveCommands(game));
    }
    async function startPondering(engine: IAssignedEngine, game: IGame, ponderMove: IMove): Promise<void> {
      const session = _requireInitialisedSession(engine);
      _requireState(session, UciSessionState.Ready, 'start pondering');
      _requireLivePosition(game);
      await _prepareGameBoundary(engine, session, game);
      session.expectedPonderMove = ponderMove;
      session.position = undefined; // ponder output is not decodable against a known position
      await _startSearch(engine, session, UciSessionState.Pondering, buildPonderMoveCommands(game, ponderMove));
    }
    async function stopAnalysis(engine: IAssignedEngine): Promise<void> {
      const session = _requireInitialisedSession(engine);
      if (session.state === UciSessionState.Ready) return;
      _requireState(session, UciSessionState.Analysing, 'stop analysis');
      await _stopSearch(engine, session, UciSessionState.StoppingAnalysis);
    }
    async function stopEngine(engine: IAssignedEngine): Promise<void> {
      _requireProcessHandle(engine);
      const session = _getSession(engine);
      if (session) _stopUciSession(session);
    }

    // #endregion

    // #region Private methods

    function _attachToProcess(engine: IAssignedEngine, processHandle: ProcessHandle, session: IUciSession): void {
      const runtimeState = _requireRuntimeAssignedEngine(engine).$;
      if (runtimeState.processHandle !== processHandle) throw _createInvalidProcessHandleError(`Engine process handle changed while initialising ${engine.displayName}.`);
      const process = _requireProcess(processHandle);
      if (session.process === process && session.detachProcessListeners) return;
      if (session.process || session.detachProcessListeners) _stopUciSession(session, 'Engine process was restarted.');
      session.process = process;
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (session.state === UciSessionState.Stopped) return;
        const error = _createPlatformError(PlatformErrorKind.UnexpectedExit, 'engineClient', `Engine exited unexpectedly for ${engine.displayName}.`, `code=${code ?? 'null'} signal=${signal ?? 'null'}`);
        _failUciSession(session, error);
      };
      session.detachProcessListeners = attachProcessLineListeners(process, (line) => _consumeLine(engine, session, line), onExit);
    }
    function _beginStateWait(session: IUciSession): Deferred<void> {
      if (session.stateDeferred) throw new Error(`UCI session already has a pending state transition from ${session.state}.`);
      const deferred = new Deferred<void>();
      session.stateDeferred = deferred;
      return deferred;
    }
    function _buildAnalysisUpdate(position: IBoardPosition, analysisLines: Map<number, IAnalysisLine>, isFinal: boolean, bestMove?: IMove): IEngineAnalysisUpdate {
      const lines = [...analysisLines.entries()].sort((left, right) => left[0] - right[0]).map(([, line]) => line);
      return { position, positionKey: buildPositionKey(position), bestMove: bestMove ?? lines[0]?.pv[0], lines, isFinal };
    }
    function _parseDetailedBestMove(position: IBoardPosition, line: string): IMove | undefined {
      const parsed = parseBestMoveLine(line);
      if (!parsed) return;
      const [move, ponderMove] = genDetailedMoves(position, parsed.ponderMove ? [parsed.move, parsed.ponderMove] : [parsed.move]);
      if (!move) throw new Error('UCI bestmove did not contain a move.');
      if (ponderMove) (move.$ ??= {}).ponderMove = ponderMove;
      return move;
    }
    function _parseDetailedAnalysisLine(position: IBoardPosition, line: string): IAnalysisLine | undefined {
      const parsed = parseInfoLine(line);
      if (!parsed) return;
      const pv = genDetailedMoves(position, parsed.pv);
      return { depth: parsed.depth, scoreCp: parsed.scoreCp, scoreMate: parsed.scoreMate, pv, $: { reference: parsed.reference } };
    }
    function _completeAnalysis(engine: IAssignedEngine, session: IUciSession, line: string): void {
      const position = _requireSessionPosition(session);
      const bestMove = _parseDetailedBestMove(position, line);
      if (!bestMove) throw new Error(`Expected UCI bestmove while analysing: ${line}.`);
      session.state = UciSessionState.Ready;
      _requireRuntimeState(engine).analysisCallback?.(_buildAnalysisUpdate(position, _requireRuntimeState(engine).analysisLines, true, bestMove));
    }
    function _completePlayerMove(session: IUciSession, line: string): void {
      const position = _requireSessionPosition(session);
      const move = _parseDetailedBestMove(position, line);
      if (!move) throw new Error(`Expected UCI bestmove while finding a move: ${line}.`);
      const deferred = session.playerMoveDeferred;
      if (!deferred) throw new Error('UCI player move completed without a pending move request.');
      session.state = UciSessionState.Ready;
      deferred.resolve(move);
    }
    function _consumeAnalysingLine(engine: IAssignedEngine, session: IUciSession, line: string): void {
      if (line.startsWith('info ')) {
        const position = _requireSessionPosition(session);
        const analysisLine = _parseDetailedAnalysisLine(position, line);
        if (!analysisLine) return;
        const reference = analysisLine.$?.reference;
        if (reference === undefined) throw new Error('Parsed analysis line is missing its runtime reference.');
        const runtimeState = _requireRuntimeState(engine);
        runtimeState.analysisLines.set(reference, analysisLine);
        runtimeState.analysisCallback?.(_buildAnalysisUpdate(position, runtimeState.analysisLines, false));
        return;
      }
      if (line.startsWith('bestmove ')) {
        _completeAnalysis(engine, session, line);
        return;
      }
      _throwUnexpectedControlLine(session, line);
    }
    function _consumeAwaitingReadyOkLine(session: IUciSession, line: string): void {
      if (line === 'readyok') {
        _resolveStateWait(session, UciSessionState.Ready);
        return;
      }
      _throwUnexpectedControlLine(session, line);
    }
    function _consumeAwaitingUciOkLine(engine: IAssignedEngine, session: IUciSession, line: string): void {
      if (line === 'uciok') {
        _resolveStateWait(session, UciSessionState.Created);
        return;
      }
      if (line === 'registration error') {
        void _writeCommand(_requireProcessHandle(engine), buildRegisterCommand()).catch((error) => _failUciSession(session, error));
        return;
      }
      if (line.startsWith('option ')) session.optionLines.push(line);
      else _throwUnexpectedControlLine(session, line);
    }
    function _consumeLine(engine: IAssignedEngine, session: IUciSession, line: string): void {
      if (line.length === 0) return;
      try {
        switch (session.state) {
          case UciSessionState.AwaitingUciOk:
            _consumeAwaitingUciOkLine(engine, session, line);
            return;
          case UciSessionState.AwaitingReadyOk:
            _consumeAwaitingReadyOkLine(session, line);
            return;
          case UciSessionState.Analysing:
            _consumeAnalysingLine(engine, session, line);
            return;
          case UciSessionState.FindingMove:
            if (line.startsWith('bestmove ')) _completePlayerMove(session, line);
            else _throwUnexpectedControlLine(session, line);
            return;
          case UciSessionState.StoppingAnalysis:
          case UciSessionState.StoppingPonder:
            if (line.startsWith('bestmove ')) _resolveStateWait(session, UciSessionState.Ready);
            else _throwUnexpectedControlLine(session, line);
            return;
          case UciSessionState.Pondering:
            if (line.startsWith('bestmove ')) throw new Error('UCI engine returned bestmove before ponderhit or stop.');
            _throwUnexpectedControlLine(session, line);
            return;
          default:
            _throwUnexpectedControlLine(session, line);
        }
      } catch (error) {
        _requireRuntimeState(engine).lastError = error instanceof Error ? error.message : 'UCI protocol error.';
        _failUciSession(session, error);
      }
    }
    function _createStateError(session: IUciSession, operation: string): Error {
      return new Error(`Cannot ${operation} while UCI session state is ${session.state}.`);
    }
    /** the searched position is owned by the game runtime; the client never derives one itself */
    function _requireLivePosition(game: IGame): IBoardPosition {
      const livePosition = game.$?.livePosition;
      if (!livePosition) throw new Error(`Live position is unavailable for game ${game.metadata.id}.`);
      return livePosition;
    }
    function _requireRenderedPosition(game: IGame): IBoardPosition {
      const renderedPosition = game.$?.renderedPosition;
      if (!renderedPosition) throw new Error(`Rendered position is unavailable for game ${game.metadata.id}.`);
      return renderedPosition;
    }
    function _getSession(engine: IAssignedEngine): IUciSession | undefined {
      return _requireAssignedUciEngine(engine).$?.session;
    }
    async function _prepareGameBoundary(engine: IAssignedEngine, session: IUciSession, game: IGame): Promise<void> {
      if (_requiresNewGameBoundary(session, game)) {
        try {
          await _writeCommand(_requireProcessHandle(engine), buildUciNewGameCommand());
          session.state = UciSessionState.AwaitingReadyOk;
          session.state = await _writeCommandAndAwaitState(session, _requireProcessHandle(engine), buildIsReadyCommand(), UciSessionState.Ready);
        } catch (error) {
          if (session.state !== UciSessionState.Failed) _failUciSession(session, error);
          throw error;
        }
      }
      session.gameId = game.metadata.id;
      session.rootFen = buildFen(game.rootPosition);
    }
    function _requireInitialisedSession(engine: IAssignedEngine): IUciSession {
      const session = _requireSession(engine);
      if (_isInitialisedState(session.state)) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireProcess(processHandle: ProcessHandle | undefined): ISpawnedProcess {
      if (!processHandle) throw _createInvalidProcessHandleError('Engine process handle is unavailable.');
      const process = processRegistry.get(processHandle);
      if (process) return process;
      throw _createInvalidProcessHandleError(`Engine process handle is no longer valid: ${processHandle}.`);
    }
    function _requireProcessHandle(engine: IAssignedEngine): ProcessHandle {
      const processHandle = _requireRuntimeAssignedEngine(engine).$.processHandle;
      if (processHandle) return processHandle;
      throw _createInvalidProcessHandleError(`Engine process handle is unavailable for ${engine.displayName}.`);
    }
    function _requireRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime {
      return _requireRuntimeAssignedEngine(engine).$;
    }
    function _requireSession(engine: IAssignedEngine): IUciSession {
      const session = _getSession(engine);
      if (session) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireSessionPosition(session: IUciSession): IBoardPosition {
      if (session.position) return session.position;
      throw new Error(`UCI session position is unavailable while state is ${session.state}.`);
    }
    function _requireState(session: IUciSession, state: UciSessionState, operation: string): void {
      if (session.state === state) return;
      throw _createStateError(session, operation);
    }
    // the root position is edited in place during board edit, so this compares its value, not its identity
    function _requiresNewGameBoundary(session: IUciSession, game: IGame): boolean {
      return session.gameId !== game.metadata.id || session.rootFen !== buildFen(game.rootPosition);
    }
    function _resolveStateWait(session: IUciSession, state: UciSessionState): void {
      const deferred = session.stateDeferred;
      if (!deferred) throw new Error(`UCI session received a transition response while state is ${session.state}.`);
      session.stateDeferred = undefined;
      session.state = state;
      deferred.resolve();
    }
    async function _startSearch(engine: IAssignedEngine, session: IUciSession, state: UciSessionState, commands: readonly string[]): Promise<void> {
      session.state = state;
      try {
        for (const command of commands) await _writeCommand(_requireProcessHandle(engine), command);
      } catch (error) {
        _failUciSession(session, error);
        throw error;
      }
    }
    async function _stopSearch(engine: IAssignedEngine, session: IUciSession, state: UciSessionState, command: string = buildStopCommand()): Promise<void> {
      session.state = state;
      const deferred = _beginStateWait(session);
      try {
        await _writeCommand(_requireProcessHandle(engine), command);
        await deferred;
      } catch (error) {
        if (session.state !== UciSessionState.Failed) _failUciSession(session, error);
        throw error;
      }
    }
    function _throwUnexpectedControlLine(session: IUciSession, line: string): void {
      if (/^(bestmove|option|readyok|registration|uciok)(?:\s|$)/.test(line)) throw new Error(`Unexpected UCI output while state is ${session.state}: ${line}.`);
    }
    async function _writeCommand(processHandle: ProcessHandle | undefined, command: string): Promise<void> {
      if (!processHandle) throw _createInvalidProcessHandleError('Engine process handle is unavailable.');
      await writeProcessLine(_requireProcess(processHandle), processHandle, command);
    }
    async function _writeCommandAndAwaitState(session: IUciSession, processHandle: ProcessHandle, command: string, resolvedState: UciSessionState): Promise<UciSessionState> {
      const deferred = _beginStateWait(session);
      await _writeCommand(processHandle, command);
      await deferred;
      return resolvedState;
    }

    // #endregion

    return { awaitPlayerTurnMove, getOptions, initialiseEngine, restartEngine, startAnalysis, startPlayerTurn, startPondering, stopAnalysis, stopEngine } satisfies IEngineClient;
  });
}
