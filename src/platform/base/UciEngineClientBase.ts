import { EngineAnalysisSearchMode, EngineClientType, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IBoardPosition, type IEngineAnalysisRequest, type IEngineOptionMeta, type IGame, type IMove, type IMoveRaw, type IPlatformError } from '@/contracts';
import type { EngineAnalysisUpdateHandler, IEngineAnalysisUpdate, IEngineClient, IProcess } from '@/contracts/platform';
import { Deferred } from '@/utility/async/Deferred';
import { cloneBoardPosition, genDetailedMoves } from '@/utility/chess/GameRuleUtility';
import { buildFen } from '@/utility/chess/MoveNotationUtility';
import { buildAnalysisCommands, buildFindNextMoveCommands, buildIsReadyCommand, buildPonderMoveCommands, buildRegisterCommand, buildSetOptionCommand, buildStopCommand, buildUciCommand, buildUciNewGameCommand, isPonderHit, parseBestMoveLine, parseInfoLine, parseOptionLines } from '@/utility/UciUtility';

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
  process?: IProcess;
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

export abstract class UciEngineClientBase implements IEngineClient {
  protected abstract _isProcessOpen(process: IProcess): boolean;
  protected abstract _getProcessExitDetail(process: IProcess): string | undefined;
  async awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
    const session = this._requireInitialisedSession(engine);
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
  getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[] {
    return this._requireInitialisedSession(engine).options;
  }
  async initialiseEngine(engine: IAssignedEngine) {
    const process = this._requireProcess(engine);
    let session = this._initialiseAssignedEngineSession(engine);
    if (this._isInitialisedState(session.current.state) && session.process === process) return;
    if (this._isInitialisedState(session.current.state)) this._stopUciSession(session, 'Engine process was replaced.');
    if (session.current.state === UciSessionState.Failed || session.current.state === UciSessionState.Stopped) session = this._replaceAssignedEngineSession(engine);
    if (session.current.state !== UciSessionState.Created) throw this._createStateError(session, 'initialise engine');
    this._attachToProcess(engine, process, session);
    try {
      session.options = parseOptionLines(await this._awaitUciOk(session, process));
      for (const [optionName, value] of Object.entries(engine.options)) await this._writeCommand(process, buildSetOptionCommand(optionName, value));
      await this._awaitReadyOk(session, process);
    } catch (error) {
      if (!this._isFailedSession(session)) this._failUciSession(session, error);
      throw error;
    }
  }
  async restartEngine(engine: IAssignedEngine) {
    await this.stopEngine(engine);
    await this.initialiseEngine(engine);
  }
  async startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: EngineAnalysisUpdateHandler) {
    if (request.searchMode !== EngineAnalysisSearchMode.Infinite) throw new Error(`Unsupported engine search mode: ${request.searchMode}.`);
    const session = this._requireInitialisedSession(engine);
    const position = cloneBoardPosition(this._requireRenderedPosition(game));
    const commands = buildAnalysisCommands(game);
    const gameId = game.metadata.id;
    const rootFen = buildFen(game.rootPosition);
    const optionCommand = buildSetOptionCommand('MultiPV', request.multiPv);
    if (session.current.state === UciSessionState.Analysing) await this._stopSearch(engine, session);
    this._requireState(session, UciSessionState.Ready, 'start analysis');
    await this._prepareGameBoundaryIfNewGame(engine, session, gameId, rootFen);
    this._requireState(session, UciSessionState.Ready, 'start analysis');
    const runtimeState = this._requireRuntimeState(engine);
    runtimeState.analysisLines.clear();
    await this._writeCommand(this._requireProcess(engine), optionCommand);
    this._requireState(session, UciSessionState.Ready, 'start analysis');
    session.current = { state: UciSessionState.Analysing, position, onUpdate };
    await this._writeSearchCommands(engine, session, commands);
  }
  async startPlayerTurn(engine: IAssignedEngine, game: IGame) {
    const session = this._requireInitialisedSession(engine);
    let commands: readonly string[];
    const context = session.current;
    if (context.state === UciSessionState.Pondering) {
      if (!isPonderHit(game, context.expectedMove)) {
        await this._stopSearch(engine, session);
        await this._prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
      }
    } else {
      this._requireState(session, UciSessionState.Ready, 'start player turn');
      await this._prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
    }
    commands = buildFindNextMoveCommands(game, (session.current as Partial<IUciPonderingSessionContext>)?.expectedMove);
    const position = this._requireLivePosition(game);
    const playerMoveCompletion = new Deferred<IMove>();
    session.current = { state: UciSessionState.FindingMove, position, playerMoveCompletion };
    await this._writeSearchCommands(engine, session, commands);
  }
  async startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMoveRaw, ponderMove: IMoveRaw) {
    const session = this._requireInitialisedSession(engine);
    this._requireState(session, UciSessionState.Ready, 'start pondering');
    await this._prepareGameBoundaryIfNewGame(engine, session, game.metadata.id, buildFen(game.rootPosition));
    const commands = buildPonderMoveCommands(game, engineMove, ponderMove);
    session.current = { state: UciSessionState.Pondering, expectedMove: ponderMove };
    await this._writeSearchCommands(engine, session, commands);
  }
  async stopAnalysis(engine: IAssignedEngine) {
    const session = this._requireInitialisedSession(engine);
    if (session.current.state === UciSessionState.Ready) return;
    this._requireState(session, UciSessionState.Analysing, 'stop analysis');
    await this._stopSearch(engine, session);
  }
  async stopEngine(engine: IAssignedEngine) {
    if (!this._requireRuntimeAssignedEngine(engine).$.process) throw this._createInvalidProcessHandleError('Engine process is unavailable.');
    const session = this._getSession(engine);
    if (session) this._stopUciSession(session);
  }
  private _createInvalidProcessHandleError(message: string, detail?: string): IPlatformError {
    return this._createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'engineClient', message, detail);
  }
  private _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
    return { kind, operation, message, detail };
  }
  private _createUciSession(): IUciSession {
    return { current: { state: UciSessionState.Created }, options: [] };
  }
  private _failUciSession(session: IUciSession, error: unknown) {
    if (session.current.state === UciSessionState.Stopped || session.current.state === UciSessionState.Failed) return;
    this._terminateUciSession(session, { state: UciSessionState.Failed }, error);
  }
  private _initialiseAssignedEngineSession(engine: IAssignedEngine): IUciSession {
    const assignedUciEngine = this._requireAssignedUciEngine(engine);
    const runtimeEngine = this._requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
    if (runtimeEngine.$.session) return runtimeEngine.$.session;
    return this._replaceAssignedEngineSession(engine);
  }
  private _isAssignedEngineUci(engine: IAssignedEngine): engine is IAssignedUciEngine {
    return engine.clientType === EngineClientType.Uci;
  }
  private _isInitialisedState(state: UciSessionState): boolean {
    return state === UciSessionState.Ready || state === UciSessionState.Analysing || state === UciSessionState.FindingMove || state === UciSessionState.PlayerMoveReady || state === UciSessionState.Pondering || state === UciSessionState.StoppingSearch;
  }
  private _isRuntimeAssignedEngine(engine: IAssignedEngine): engine is IRuntimeAssignedEngine {
    return !!engine.$;
  }
  private _requireAssignedUciEngine(engine: IAssignedEngine): IAssignedUciEngine {
    if (this._isAssignedEngineUci(engine)) return engine;
    throw this._createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', 'Engine client type is not UCI.');
  }
  private _requireRuntimeAssignedEngine(engine: IAssignedEngine): IRuntimeAssignedEngine {
    if (this._isRuntimeAssignedEngine(engine)) return engine;
    throw this._createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine runtime is not available for ${engine.displayName}.`);
  }
  private _replaceAssignedEngineSession(engine: IAssignedEngine): IUciSession {
    const assignedUciEngine = this._requireAssignedUciEngine(engine);
    const runtimeEngine = this._requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
    runtimeEngine.$.session = this._createUciSession();
    return runtimeEngine.$.session;
  }
  private _stopUciSession(session: IUciSession, message = 'Engine stopped.') {
    this._terminateUciSession(session, { state: UciSessionState.Stopped }, new Error(message));
  }
  private _terminateUciSession(session: IUciSession, terminalContext: IUciFailedSessionContext | IUciStoppedSessionContext, error: unknown) {
    this._rejectContextCompletion(session.current, error);
    session.current = terminalContext;
    session.gameId = undefined;
    session.rootFen = undefined;
    session.options = [];
    session.detachProcessListeners?.();
    session.detachProcessListeners = undefined;
    session.process = undefined;
  }
  private _rejectContextCompletion(context: UciSessionContext, error: unknown) {
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
  private _attachToProcess(engine: IAssignedEngine, process: IProcess, session: IUciSession) {
    const runtimeState = this._requireRuntimeAssignedEngine(engine).$;
    if (runtimeState.process !== process) throw this._createInvalidProcessHandleError(`Engine process changed while initialising ${engine.displayName}.`);
    if (session.process === process && session.detachProcessListeners) return;
    if (session.process || session.detachProcessListeners) this._stopUciSession(session, 'Engine process was restarted.');
    session.process = process;
    const onExit = () => {
      if (session.current.state === UciSessionState.Stopped) return;
      const error = this._createPlatformError(PlatformErrorKind.UnexpectedExit, 'engineClient', `Engine exited unexpectedly for ${engine.displayName}.`, this._getProcessExitDetail(process));
      this._failUciSession(session, error);
    };
    session.detachProcessListeners = this._attachProcessLineListeners(process, (line) => this._consumeLine(engine, session, line), onExit);
  }
  private _buildAnalysisUpdate(position: IBoardPosition, analysisLines: Map<number, IAnalysisLine>, isFinal: boolean, bestMove?: IMove): IEngineAnalysisUpdate {
    const lines = [...analysisLines.entries()].sort((left, right) => left[0] - right[0]).map(([, line]) => line);
    return { position, bestMove: bestMove ?? lines[0]?.pv[0], lines, isFinal };
  }
  private _parseDetailedBestMove(position: IBoardPosition, line: string): IMove | undefined {
    const parsed = parseBestMoveLine(line);
    if (!parsed) return;
    const [move, ponderMove] = genDetailedMoves(position, parsed.ponderMove ? [parsed.move, parsed.ponderMove] : [parsed.move]);
    if (!move) throw new Error('UCI bestmove did not contain a move.');
    if (ponderMove) (move.$ ??= {}).ponderMove = ponderMove;
    return move;
  }
  private _parseDetailedAnalysisLine(position: IBoardPosition, line: string): IAnalysisLine | undefined {
    const parsed = parseInfoLine(line);
    if (!parsed) return;
    const pv = genDetailedMoves(position, parsed.pv);
    return { depth: parsed.depth, scoreCp: parsed.scoreCp, scoreMate: parsed.scoreMate, pv, $: { reference: parsed.reference } };
  }
  private _completeAnalysis(engine: IAssignedEngine, session: IUciSession, context: IUciAnalysingSessionContext, line: string) {
    const bestMove = this._parseDetailedBestMove(context.position, line);
    if (!bestMove) throw new Error(`Expected UCI bestmove while analysing: ${line}.`);
    session.current = { state: UciSessionState.Ready };
    context.onUpdate(this._buildAnalysisUpdate(context.position, this._requireRuntimeState(engine).analysisLines, true, bestMove));
  }
  private _completePlayerMove(session: IUciSession, context: IUciFindingMoveSessionContext, line: string) {
    const move = this._parseDetailedBestMove(context.position, line);
    if (!move) throw new Error(`Expected UCI bestmove while finding a move: ${line}.`);
    session.current = { state: UciSessionState.PlayerMoveReady, move, playerMoveCompletion: context.playerMoveCompletion };
    context.playerMoveCompletion.resolve(move);
  }
  private _consumeAnalysingLine(engine: IAssignedEngine, session: IUciSession, context: IUciAnalysingSessionContext, line: string) {
    if (line.startsWith('info ')) {
      let analysisLine: IAnalysisLine | undefined;
      try {
        analysisLine = this._parseDetailedAnalysisLine(context.position, line);
      } catch {
        return;
      }
      if (!analysisLine) return;
      const reference = analysisLine.$?.reference;
      if (reference === undefined) throw new Error('Parsed analysis line is missing its runtime reference.');
      const runtimeState = this._requireRuntimeState(engine);
      const previousLine = runtimeState.analysisLines.get(reference);
      runtimeState.analysisLines.set(reference, analysisLine);
      if (context.onUpdate(this._buildAnalysisUpdate(context.position, runtimeState.analysisLines, false)) === false) {
        if (previousLine) runtimeState.analysisLines.set(reference, previousLine);
        else runtimeState.analysisLines.delete(reference);
      }
      return;
    }
    if (line.startsWith('bestmove ')) {
      this._completeAnalysis(engine, session, context, line);
      return;
    }
    this._throwUnexpectedControlLine(session, line);
  }
  private _consumeAwaitingReadyOkLine(session: IUciSession, context: IUciAwaitingReadyOkSessionContext, line: string) {
    if (line === 'readyok') {
      this._completeStateWait(session, context, UciSessionState.Ready);
      return;
    }
    this._throwUnexpectedControlLine(session, line);
  }
  private _consumeAwaitingUciOkLine(engine: IAssignedEngine, session: IUciSession, context: IUciAwaitingUciOkSessionContext, line: string) {
    if (line === 'uciok') {
      this._completeStateWait(session, context, UciSessionState.Created);
      return;
    }
    if (line === 'registration error') {
      void this._writeCommand(this._requireProcess(engine), buildRegisterCommand()).catch((error) => this._failUciSession(session, error));
      return;
    }
    if (line.startsWith('option ')) context.optionLines.push(line);
    else this._throwUnexpectedControlLine(session, line);
  }
  private _consumeLine(engine: IAssignedEngine, session: IUciSession, line: string) {
    if (line.length === 0) return;
    try {
      const context = session.current;
      switch (context.state) {
        case UciSessionState.AwaitingUciOk:
          this._consumeAwaitingUciOkLine(engine, session, context, line);
          return;
        case UciSessionState.AwaitingReadyOk:
          this._consumeAwaitingReadyOkLine(session, context, line);
          return;
        case UciSessionState.Analysing:
          this._consumeAnalysingLine(engine, session, context, line);
          return;
        case UciSessionState.FindingMove:
          if (line.startsWith('bestmove ')) this._completePlayerMove(session, context, line);
          else this._throwUnexpectedControlLine(session, line);
          return;
        case UciSessionState.StoppingSearch:
          if (line.startsWith('bestmove ')) this._completeStateWait(session, context, UciSessionState.Ready);
          else this._throwUnexpectedControlLine(session, line);
          return;
        case UciSessionState.Pondering:
          if (line.startsWith('bestmove ')) throw new Error('UCI engine returned bestmove before ponderhit or stop.');
          this._throwUnexpectedControlLine(session, line);
          return;
        default:
          this._throwUnexpectedControlLine(session, line);
      }
    } catch (error) {
      this._requireRuntimeState(engine).lastError = error instanceof Error ? error.message : 'UCI protocol error.';
      this._failUciSession(session, error);
    }
  }
  private _createStateError(session: IUciSession, operation: string): Error {
    return new Error(`Cannot ${operation} while UCI session state is ${session.current.state}.`);
  }
  private _requireLivePosition(game: IGame): IBoardPosition {
    const livePosition = game.$?.livePosition;
    if (!livePosition) throw new Error(`Live position is unavailable for game ${game.metadata.id}.`);
    return livePosition;
  }
  private _requireRenderedPosition(game: IGame): IBoardPosition {
    const renderedPosition = game.$?.renderedPosition;
    if (!renderedPosition) throw new Error(`Rendered position is unavailable for game ${game.metadata.id}.`);
    return renderedPosition;
  }
  private _getSession(engine: IAssignedEngine): IUciSession | undefined {
    return this._requireAssignedUciEngine(engine).$?.session;
  }
  private _isFailedSession(session: IUciSession): boolean {
    return session.current.state === UciSessionState.Failed;
  }
  private async _prepareGameBoundaryIfNewGame(engine: IAssignedEngine, session: IUciSession, gameId: string, rootFen: string) {
    if (this._requiresNewGameBoundary(session, gameId, rootFen)) {
      try {
        await this._writeCommand(this._requireProcess(engine), buildUciNewGameCommand());
        await this._awaitReadyOk(session, this._requireProcess(engine));
      } catch (error) {
        if (!this._isFailedSession(session)) this._failUciSession(session, error);
        throw error;
      }
    }
    this._assertSessionOperational(session);
    session.gameId = gameId;
    session.rootFen = rootFen;
  }
  private _requireInitialisedSession(engine: IAssignedEngine): IUciSession {
    const session = this._requireSession(engine);
    if (this._isInitialisedState(session.current.state)) return session;
    throw this._createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
  }
  private _requireProcess(engine: IAssignedEngine): IProcess {
    const process = this._requireRuntimeAssignedEngine(engine).$.process;
    if (!process) throw this._createInvalidProcessHandleError(`Engine process is unavailable for ${engine.displayName}.`);
    if (!this._isProcessOpen(process)) throw this._createInvalidProcessHandleError(`Engine process is no longer running for ${engine.displayName}.`);
    return process;
  }
  private _requireRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime {
    return this._requireRuntimeAssignedEngine(engine).$;
  }
  private _requireSession(engine: IAssignedEngine): IUciSession {
    const session = this._getSession(engine);
    if (session) return session;
    throw this._createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
  }
  private _requireState(session: IUciSession, state: UciSessionState, operation: string) {
    if (session.current.state === state) return;
    throw this._createStateError(session, operation);
  }
  private _requiresNewGameBoundary(session: IUciSession, gameId: string, rootFen: string): boolean {
    return session.gameId !== gameId || session.rootFen !== rootFen;
  }
  private _assertSessionOperational(session: IUciSession) {
    if (session.current.state === UciSessionState.Stopped || session.current.state === UciSessionState.Failed) throw this._createStateError(session, 'continue operation');
  }
  private _completeStateWait(session: IUciSession, context: IUciAwaitingReadyOkSessionContext | IUciAwaitingUciOkSessionContext | IUciStoppingSearchSessionContext, state: UciSessionState.Created | UciSessionState.Ready) {
    if (session.current !== context) throw new Error(`UCI session received a stale transition response while state is ${session.current.state}.`);
    session.current = state === UciSessionState.Created ? { state: UciSessionState.Created } : { state: UciSessionState.Ready };
    context.completion.resolve();
  }
  private async _awaitReadyOk(session: IUciSession, process: IProcess) {
    this._assertSessionOperational(session);
    const context: IUciAwaitingReadyOkSessionContext = { state: UciSessionState.AwaitingReadyOk, completion: new Deferred<void>() };
    session.current = context;
    await this._writeCommand(process, buildIsReadyCommand());
    await context.completion;
  }
  private async _awaitUciOk(session: IUciSession, process: IProcess): Promise<string[]> {
    const context: IUciAwaitingUciOkSessionContext = { state: UciSessionState.AwaitingUciOk, completion: new Deferred<void>(), optionLines: [] };
    session.current = context;
    await this._writeCommand(process, buildUciCommand());
    await context.completion;
    return context.optionLines;
  }
  private async _writeSearchCommands(engine: IAssignedEngine, session: IUciSession, commands: readonly string[]) {
    try {
      for (const command of commands) {
        this._assertSessionOperational(session);
        await this._writeCommand(this._requireProcess(engine), command);
      }
      this._assertSessionOperational(session);
    } catch (error) {
      this._failUciSession(session, error);
      throw error;
    }
  }
  private async _stopSearch(engine: IAssignedEngine, session: IUciSession) {
    if (!(session.current.state == UciSessionState.Analysing
      || session.current.state == UciSessionState.Pondering)) throw this._createStateError(session, 'stop search');
    const context: IUciStoppingSearchSessionContext = { state: UciSessionState.StoppingSearch, completion: new Deferred<void>() };
    session.current = context;
    try {
      await this._writeCommand(this._requireProcess(engine), buildStopCommand());
      await context.completion;
    } catch (error) {
      if (!this._isFailedSession(session)) this._failUciSession(session, error);
      throw error;
    }
  }
  private _throwUnexpectedControlLine(session: IUciSession, line: string) {
    if (/^(bestmove|option|readyok|registration|uciok)(?:\s|$)/.test(line)) throw new Error(`Unexpected UCI output while state is ${session.current.state}: ${line}.`);
  }
  private async _writeCommand(process: IProcess, command: string) {
    await this._writeProcessLine(process, command);
  }
  private _attachProcessLineListeners(process: IProcess, onLine: (line: string) => void, onExit: (code: number | null, signal: string | null) => void): () => void {
    let lineBuffer = '';
    const _onData = (chunk: string) => {
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) onLine(trimmedLine);
      }
    };
    process.stdout?.on('data', _onData);
    process.stderr?.on('data', _onData);
    process.once('exit', onExit);
    return () => {
      process.stdout?.removeListener('data', _onData);
      process.stderr?.removeListener('data', _onData);
      process.removeListener('exit', onExit);
    };
  }
  private async _writeProcessLine(process: IProcess, command: string) {
    if (!this._isProcessOpen(process)) throw this._createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'engineClient', 'Engine process is no longer running.');
    if (!process.stdin) throw this._createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', 'Engine stdin is unavailable.');
    process.stdin.write(`${command}\n`);
  }
}
