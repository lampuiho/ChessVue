import { defineStore } from 'pinia';

import { EngineAnalysisSearchMode, EngineClientType, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisRequest, type IEngineOptionMeta, type IGame, type IMove, type IMoveRaw, type IPlatformError } from '@/contracts';
import type { EngineAnalysisUpdateHandler, IEngineAnalysisUpdate, IEngineClient } from '@/contracts/platform';
import { Deferred } from '@/utility/async/Deferred';
import { cloneBoardPosition, genDetailedMoves } from '@/utility/chess/GameRuleUtility';
import { buildFen } from '@/utility/chess/MoveNotationUtility';
import { attachProcessLineListeners, isProcessOpen, writeProcessLine, type INwjsGlobal, type ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';
import { buildAnalysisCommands, buildFindNextMoveCommands, buildIsReadyCommand, buildPonderMoveCommands, buildRegisterCommand, buildSetOptionCommand, buildStopCommand, buildUciCommand, buildUciNewGameCommand, isPonderHit, parseBestMoveLine, parseInfoLine, parseOptionLines } from '../../utility/UciUtility';

const enum UciSessionState {
  Created = 'created',
  AwaitingUciOk = 'awaitingUciOk',
  AwaitingReadyOk = 'awaitingReadyOk',
  Ready = 'ready',
  Analysing = 'analysing',
  FindingMove = 'findingMove',
  PlayerMoveReady = 'playerMoveReady',
  Pondering = 'pondering',
  StoppingSearch = 'stoppingSearch',
  Stopped = 'stopped',
  Failed = 'failed',
}
interface IUciCreatedSessionContext {
  state: UciSessionState.Created;
}
interface IUciAwaitingUciOkSessionContext {
  state: UciSessionState.AwaitingUciOk;
  completion: Deferred<void>;
  optionLines: string[];
}
interface IUciAwaitingReadyOkSessionContext {
  state: UciSessionState.AwaitingReadyOk;
  completion: Deferred<void>;
}
interface IUciReadySessionContext {
  state: UciSessionState.Ready;
}
interface IUciAnalysingSessionContext {
  state: UciSessionState.Analysing;
  position: IBoardPosition;
  onUpdate: EngineAnalysisUpdateHandler;
}
interface IUciFindingMoveSessionContext {
  state: UciSessionState.FindingMove;
  position: IBoardPosition;
  playerMoveCompletion: Deferred<IMove>;
}
interface IUciPlayerMoveReadySessionContext {
  state: UciSessionState.PlayerMoveReady;
  move: IMove;
  playerMoveCompletion: Deferred<IMove>;
}
interface IUciPonderingSessionContext {
  state: UciSessionState.Pondering;
  expectedMove: IMoveRaw;
}
interface IUciStoppingSearchSessionContext {
  state: UciSessionState.StoppingSearch;
  completion: Deferred<void>;
}
interface IUciStoppedSessionContext {
  state: UciSessionState.Stopped;
}
interface IUciFailedSessionContext {
  state: UciSessionState.Failed;
}
type UciSessionContext = IUciCreatedSessionContext | IUciAwaitingUciOkSessionContext | IUciAwaitingReadyOkSessionContext | IUciReadySessionContext | IUciAnalysingSessionContext | IUciFindingMoveSessionContext | IUciPlayerMoveReadySessionContext | IUciPonderingSessionContext | IUciStoppingSearchSessionContext | IUciStoppedSessionContext | IUciFailedSessionContext;
interface IUciSession {
  current: UciSessionContext;
  gameId?: string;
  options: IEngineOptionMeta[];
  process?: ISpawnedProcess;
  rootFen?: string;
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

export function defineNwjsUciEngineClientStore(_nw: INwjsGlobal) {
  return defineStore('nwjsUciEngineClient', () => {
    // #region Public methods
    async function awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
      const session = _requireInitialisedSession(engine);
      const context = session.current;
      if (context.state !== UciSessionState.FindingMove && context.state !== UciSessionState.PlayerMoveReady) throw new Error(`No player turn is active for engine ${engine.displayName}.`);
      const completion = context.playerMoveCompletion;
      try {
        return await completion;
      } finally {
        const current = session.current;
        if (current.state === UciSessionState.PlayerMoveReady && current.playerMoveCompletion === completion) session.current = { state: UciSessionState.Ready };
      }
    }
    function getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[] {
      return _requireInitialisedSession(engine).options;
    }
    async function initialiseEngine(engine: IAssignedEngine) {
      const process = _requireProcess(engine);
      let session = _initialiseAssignedEngineSession(engine);
      if (_isInitialisedState(session.current.state) && session.process === process) return;
      if (_isInitialisedState(session.current.state)) _stopUciSession(session, 'Engine process was replaced.');
      if (session.current.state === UciSessionState.Failed || session.current.state === UciSessionState.Stopped) session = _replaceAssignedEngineSession(engine);
      if (session.current.state !== UciSessionState.Created) throw _createStateError(session, 'initialise engine');
      _attachToProcess(engine, process, session);
      try {
        session.options = parseOptionLines(await _awaitUciOk(session, process));
        for (const [optionName, value] of Object.entries(engine.options)) await _writeCommand(process, buildSetOptionCommand(optionName, value));
        await _awaitReadyOk(session, process);
      } catch (error) {
        if (!_isFailedSession(session)) _failUciSession(session, error);
        throw error;
      }
    }
    async function restartEngine(engine: IAssignedEngine) {
      await stopEngine(engine);
      await initialiseEngine(engine);
    }
    async function startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: EngineAnalysisUpdateHandler) {
      if (request.searchMode !== EngineAnalysisSearchMode.Infinite) throw new Error(`Unsupported engine search mode: ${request.searchMode}.`);
      const session = _requireInitialisedSession(engine);
      const position = cloneBoardPosition(_requireRenderedPosition(game));
      const commands = buildAnalysisCommands(game);
      const gameId = game.metadata.id;
      const rootFen = buildFen(game.rootPosition);
      const optionCommand = buildSetOptionCommand('MultiPV', request.multiPv);
      if (session.current.state === UciSessionState.Analysing) await _stopSearch(engine, session);
      _requireState(session, UciSessionState.Ready, 'start analysis');
      await _prepareGameBoundaryIfNewGame(engine, session, gameId, rootFen);
      _requireState(session, UciSessionState.Ready, 'start analysis');
      const runtimeState = _requireRuntimeState(engine);
      runtimeState.analysisLines.clear();
      await _writeCommand(_requireProcess(engine), optionCommand);
      _requireState(session, UciSessionState.Ready, 'start analysis');
      session.current = { state: UciSessionState.Analysing, position, onUpdate };
      await _writeSearchCommands(engine, session, commands);
    }
    async function startPlayerTurn(engine: IAssignedEngine, game: IGame) {
      const session = _requireInitialisedSession(engine);
      let commands: readonly string[];
      const context = session.current;
      if (context.state === UciSessionState.Pondering) {
        if (!isPonderHit(game, context.expectedMove)) {
          await _stopSearch(engine, session);
          await _prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
        }
      } else {
        _requireState(session, UciSessionState.Ready, 'start player turn');
        await _prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
      }
      commands = buildFindNextMoveCommands(game, (session.current as Partial<IUciPonderingSessionContext>)?.expectedMove);
      const position = _requireLivePosition(game);
      const playerMoveCompletion = new Deferred<IMove>();
      session.current = { state: UciSessionState.FindingMove, position, playerMoveCompletion };
      await _writeSearchCommands(engine, session, commands);
    }
    async function startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMoveRaw, ponderMove: IMoveRaw) {
      const session = _requireInitialisedSession(engine);
      _requireState(session, UciSessionState.Ready, 'start pondering');
      await _prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
      const commands = buildPonderMoveCommands(game, engineMove, ponderMove);
      session.current = { state: UciSessionState.Pondering, expectedMove: ponderMove };
      await _writeSearchCommands(engine, session, commands);
    }
    async function stopAnalysis(engine: IAssignedEngine) {
      const session = _requireInitialisedSession(engine);
      if (session.current.state === UciSessionState.Ready) return;
      _requireState(session, UciSessionState.Analysing, 'stop analysis');
      await _stopSearch(engine, session);
    }
    async function stopEngine(engine: IAssignedEngine) {
      if (!_requireRuntimeAssignedEngine(engine).$.process) throw _createInvalidProcessHandleError('Engine process is unavailable.');
      const session = _getSession(engine);
      if (session) _stopUciSession(session);
    }
    // #endregion
    // #region Private methods
    function _createInvalidProcessHandleError(message: string, detail?: string): IPlatformError {
      return _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'engineClient', message, detail);
    }
    function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
      return { kind, operation, message, detail };
    }
    function _createUciSession(): IUciSession {
      return { current: { state: UciSessionState.Created }, options: [] };
    }
    function _failUciSession(session: IUciSession, error: unknown) {
      if (session.current.state === UciSessionState.Stopped || session.current.state === UciSessionState.Failed) return;
      _terminateUciSession(session, { state: UciSessionState.Failed }, error);
    }
    function _initialiseAssignedEngineSession(engine: IAssignedEngine): IUciSession {
      const assignedUciEngine = _requireAssignedUciEngine(engine);
      const runtimeEngine = _requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
      if (runtimeEngine.$.session) return runtimeEngine.$.session;
      return _replaceAssignedEngineSession(engine);
    }
    function _isAssignedEngineUci(engine: IAssignedEngine): engine is IAssignedUciEngine {
      return engine.clientType === EngineClientType.Uci;
    }
    function _isInitialisedState(state: UciSessionState): boolean {
      return state === UciSessionState.Ready || state === UciSessionState.Analysing || state === UciSessionState.FindingMove || state === UciSessionState.PlayerMoveReady || state === UciSessionState.Pondering || state === UciSessionState.StoppingSearch;
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
    function _replaceAssignedEngineSession(engine: IAssignedEngine): IUciSession {
      const assignedUciEngine = _requireAssignedUciEngine(engine);
      const runtimeEngine = _requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
      runtimeEngine.$.session = _createUciSession();
      return runtimeEngine.$.session;
    }
    function _stopUciSession(session: IUciSession, message = 'Engine stopped.') {
      _terminateUciSession(session, { state: UciSessionState.Stopped }, new Error(message));
    }
    function _terminateUciSession(session: IUciSession, terminalContext: IUciFailedSessionContext | IUciStoppedSessionContext, error: unknown) {
      _rejectContextCompletion(session.current, error);
      session.current = terminalContext;
      session.gameId = undefined;
      session.rootFen = undefined;
      session.options = [];
      session.detachProcessListeners?.();
      session.detachProcessListeners = undefined;
      session.process = undefined;
    }
    function _rejectContextCompletion(context: UciSessionContext, error: unknown) {
      switch (context.state) {
        case UciSessionState.AwaitingUciOk:
        case UciSessionState.AwaitingReadyOk:
        case UciSessionState.StoppingSearch:
          context.completion.reject(error);
          return;
        case UciSessionState.FindingMove:
          context.playerMoveCompletion.reject(error);
          return;
      }
    }
    function _attachToProcess(engine: IAssignedEngine, process: ISpawnedProcess, session: IUciSession) {
      const runtimeState = _requireRuntimeAssignedEngine(engine).$;
      if (runtimeState.process !== process) throw _createInvalidProcessHandleError(`Engine process changed while initialising ${engine.displayName}.`);
      if (session.process === process && session.detachProcessListeners) return;
      if (session.process || session.detachProcessListeners) _stopUciSession(session, 'Engine process was restarted.');
      session.process = process;
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (session.current.state === UciSessionState.Stopped) return;
        const error = _createPlatformError(PlatformErrorKind.UnexpectedExit, 'engineClient', `Engine exited unexpectedly for ${engine.displayName}.`, `code=${code ?? 'null'} signal=${signal ?? 'null'}`);
        _failUciSession(session, error);
      };
      session.detachProcessListeners = attachProcessLineListeners(process, (line) => _consumeLine(engine, session, line), onExit);
    }
    function _buildAnalysisUpdate(position: IBoardPosition, analysisLines: Map<number, IAnalysisLine>, isFinal: boolean, bestMove?: IMove): IEngineAnalysisUpdate {
      const lines = [...analysisLines.entries()].sort((left, right) => left[0] - right[0]).map(([, line]) => line);
      return { position, bestMove: bestMove ?? lines[0]?.pv[0], lines, isFinal };
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
    function _completeAnalysis(engine: IAssignedEngine, session: IUciSession, context: IUciAnalysingSessionContext, line: string) {
      const bestMove = _parseDetailedBestMove(context.position, line);
      if (!bestMove) throw new Error(`Expected UCI bestmove while analysing: ${line}.`);
      session.current = { state: UciSessionState.Ready };
      context.onUpdate(_buildAnalysisUpdate(context.position, _requireRuntimeState(engine).analysisLines, true, bestMove));
    }
    function _completePlayerMove(session: IUciSession, context: IUciFindingMoveSessionContext, line: string) {
      const move = _parseDetailedBestMove(context.position, line);
      if (!move) throw new Error(`Expected UCI bestmove while finding a move: ${line}.`);
      session.current = { state: UciSessionState.PlayerMoveReady, move, playerMoveCompletion: context.playerMoveCompletion };
      context.playerMoveCompletion.resolve(move);
    }
    function _consumeAnalysingLine(engine: IAssignedEngine, session: IUciSession, context: IUciAnalysingSessionContext, line: string) {
      if (line.startsWith('info ')) {
        let analysisLine: IAnalysisLine | undefined;
        try {
          analysisLine = _parseDetailedAnalysisLine(context.position, line);
        } catch {
          return;
        }
        if (!analysisLine) return;
        const reference = analysisLine.$?.reference;
        if (reference === undefined) throw new Error('Parsed analysis line is missing its runtime reference.');
        const runtimeState = _requireRuntimeState(engine);
        const previousLine = runtimeState.analysisLines.get(reference);
        runtimeState.analysisLines.set(reference, analysisLine);
        if (context.onUpdate(_buildAnalysisUpdate(context.position, runtimeState.analysisLines, false)) === false) {
          if (previousLine) runtimeState.analysisLines.set(reference, previousLine);
          else runtimeState.analysisLines.delete(reference);
        }
        return;
      }
      if (line.startsWith('bestmove ')) {
        _completeAnalysis(engine, session, context, line);
        return;
      }
      _throwUnexpectedControlLine(session, line);
    }
    function _consumeAwaitingReadyOkLine(session: IUciSession, context: IUciAwaitingReadyOkSessionContext, line: string) {
      if (line === 'readyok') {
        _completeStateWait(session, context, UciSessionState.Ready);
        return;
      }
      _throwUnexpectedControlLine(session, line);
    }
    function _consumeAwaitingUciOkLine(engine: IAssignedEngine, session: IUciSession, context: IUciAwaitingUciOkSessionContext, line: string) {
      if (line === 'uciok') {
        _completeStateWait(session, context, UciSessionState.Created);
        return;
      }
      if (line === 'registration error') {
        void _writeCommand(_requireProcess(engine), buildRegisterCommand()).catch((error) => _failUciSession(session, error));
        return;
      }
      if (line.startsWith('option ')) context.optionLines.push(line);
      else _throwUnexpectedControlLine(session, line);
    }
    function _consumeLine(engine: IAssignedEngine, session: IUciSession, line: string) {
      if (line.length === 0) return;
      try {
        const context = session.current;
        switch (context.state) {
          case UciSessionState.AwaitingUciOk:
            _consumeAwaitingUciOkLine(engine, session, context, line);
            return;
          case UciSessionState.AwaitingReadyOk:
            _consumeAwaitingReadyOkLine(session, context, line);
            return;
          case UciSessionState.Analysing:
            _consumeAnalysingLine(engine, session, context, line);
            return;
          case UciSessionState.FindingMove:
            if (line.startsWith('bestmove ')) _completePlayerMove(session, context, line);
            else _throwUnexpectedControlLine(session, line);
            return;
          case UciSessionState.StoppingSearch:
            if (line.startsWith('bestmove ')) _completeStateWait(session, context, UciSessionState.Ready);
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
      return new Error(`Cannot ${operation} while UCI session state is ${session.current.state}.`);
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
    function _isFailedSession(session: IUciSession): boolean {
      return session.current.state === UciSessionState.Failed;
    }
    async function _prepareGameBoundaryIfNewGame(engine: IAssignedEngine, session: IUciSession, gameId: string, rootFen: string) {
      if (_requiresNewGameBoundary(session, gameId, rootFen)) {
        try {
          await _writeCommand(_requireProcess(engine), buildUciNewGameCommand());
          await _awaitReadyOk(session, _requireProcess(engine));
        } catch (error) {
          if (!_isFailedSession(session)) _failUciSession(session, error);
          throw error;
        }
      }
      _assertSessionOperational(session);
      session.gameId = gameId;
      session.rootFen = rootFen;
    }
    function _requireInitialisedSession(engine: IAssignedEngine): IUciSession {
      const session = _requireSession(engine);
      if (_isInitialisedState(session.current.state)) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireProcess(engine: IAssignedEngine): ISpawnedProcess {
      const process = _requireRuntimeAssignedEngine(engine).$.process as ISpawnedProcess | undefined;
      if (!process) throw _createInvalidProcessHandleError(`Engine process is unavailable for ${engine.displayName}.`);
      if (!isProcessOpen(process)) throw _createInvalidProcessHandleError(`Engine process is no longer running for ${engine.displayName}.`);
      return process;
    }
    function _requireRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime {
      return _requireRuntimeAssignedEngine(engine).$;
    }
    function _requireSession(engine: IAssignedEngine): IUciSession {
      const session = _getSession(engine);
      if (session) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireState(session: IUciSession, state: UciSessionState, operation: string) {
      if (session.current.state === state) return;
      throw _createStateError(session, operation);
    }
    // the root position is edited in place during board edit, so this compares its value, not its identity
    function _requiresNewGameBoundary(session: IUciSession, gameId: string, rootFen: string): boolean {
      return session.gameId !== gameId || session.rootFen !== rootFen;
    }
    function _assertSessionOperational(session: IUciSession) {
      if (session.current.state === UciSessionState.Stopped || session.current.state === UciSessionState.Failed) throw _createStateError(session, 'continue operation');
    }
    function _completeStateWait(session: IUciSession, context: IUciAwaitingReadyOkSessionContext | IUciAwaitingUciOkSessionContext | IUciStoppingSearchSessionContext, state: UciSessionState.Created | UciSessionState.Ready) {
      if (session.current !== context) throw new Error(`UCI session received a stale transition response while state is ${session.current.state}.`);
      session.current = state === UciSessionState.Created ? { state: UciSessionState.Created } : { state: UciSessionState.Ready };
      context.completion.resolve();
    }
    async function _awaitReadyOk(session: IUciSession, process: ISpawnedProcess) {
      _assertSessionOperational(session);
      const context: IUciAwaitingReadyOkSessionContext = { state: UciSessionState.AwaitingReadyOk, completion: new Deferred<void>() };
      session.current = context;
      await _writeCommand(process, buildIsReadyCommand());
      await context.completion;
    }
    async function _awaitUciOk(session: IUciSession, process: ISpawnedProcess): Promise<string[]> {
      const context: IUciAwaitingUciOkSessionContext = { state: UciSessionState.AwaitingUciOk, completion: new Deferred<void>(), optionLines: [] };
      session.current = context;
      await _writeCommand(process, buildUciCommand());
      await context.completion;
      return context.optionLines;
    }
    async function _writeSearchCommands(engine: IAssignedEngine, session: IUciSession, commands: readonly string[]) {
      try {
        for (const command of commands) {
          _assertSessionOperational(session);
          await _writeCommand(_requireProcess(engine), command);
        }
        _assertSessionOperational(session);
      } catch (error) {
        _failUciSession(session, error);
        throw error;
      }
    }
    async function _stopSearch(engine: IAssignedEngine, session: IUciSession) {
      if (!(session.current.state == UciSessionState.Analysing
        || session.current.state == UciSessionState.Pondering)) throw _createStateError(session, 'stop search');
      const context: IUciStoppingSearchSessionContext = { state: UciSessionState.StoppingSearch, completion: new Deferred<void>() };
      session.current = context;
      try {
        await _writeCommand(_requireProcess(engine), buildStopCommand());
        await context.completion;
      } catch (error) {
        if (!_isFailedSession(session)) _failUciSession(session, error);
        throw error;
      }
    }
    function _throwUnexpectedControlLine(session: IUciSession, line: string) {
      if (/^(bestmove|option|readyok|registration|uciok)(?:\s|$)/.test(line)) throw new Error(`Unexpected UCI output while state is ${session.current.state}: ${line}.`);
    }
    async function _writeCommand(process: ISpawnedProcess, command: string) {
      await writeProcessLine(process, command);
    }
    // #endregion
    return { awaitPlayerTurnMove, getOptions, initialiseEngine, restartEngine, startAnalysis, startPlayerTurn, startPondering, stopAnalysis, stopEngine } satisfies IEngineClient;
  });
}
