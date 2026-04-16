import { defineStore } from 'pinia';

import { EngineAnalysisSearchMode, EngineClientType, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IEngineAnalysisRequest, type IEnginePositionState, type IEngineRegistrationRequest, type IMove, type IPlatformError } from '@/contracts';
import { PositionIdentityService } from '@/domain';
import { Deferred } from '@/utility/async/Deferred';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

import type { IEngineAnalysisUpdate, IEngineClient, ProcessHandle } from '../contracts';
import { buildPositionCommand, buildRegistrationCommand, createUciSession, failUciSession, type IUciLineWaiter, type IUciSession as IBaseUciSession, parseBestMoveLine, parseInfoLine, stopUciSession } from '../../utility/UciUtility';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';
import { attachProcessLineListeners, writeProcessLine } from './NwjsProcessLineUtility';

type IUciSession = IBaseUciSession<ISpawnedProcess>;
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
function _createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail?: string): IPlatformError {
  return { kind, operation, message, detail };
}
function _createInvalidProcessHandleError(message: string, detail?: string): IPlatformError {
  return _createPlatformError(PlatformErrorKind.InvalidProcessHandle, 'engineClient', message, detail);
}
function _isAssignedEngineUci(engine: IAssignedEngine): engine is IAssignedUciEngine {
  return engine.clientType === EngineClientType.Uci;
}
function _isRuntimeAssignedUciEngine(engine: IAssignedUciEngine): engine is IRuntimeAssignedUciEngine {
  return !!engine.$;
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
function _initialiseAssignedEngineSession(engine: IAssignedEngine): IUciSession {
  const assignedUciEngine = _requireAssignedUciEngine(engine);
  const runtimeEngine = _requireRuntimeAssignedEngine(assignedUciEngine) as IRuntimeAssignedUciEngine;
  const existingSession = (runtimeEngine.$ as Partial<IAssignedUciEngineRuntime>).session;
  if (existingSession !== undefined) return existingSession;
  runtimeEngine.$ = { ...runtimeEngine.$, session: createUciSession<ISpawnedProcess>() };
  const nextSession = runtimeEngine.$.session;
  if (_isRuntimeAssignedUciEngine(runtimeEngine) && nextSession !== undefined) return nextSession;
  throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Failed to initialise engine runtime for ${engine.displayName}.`);
}
export function defineNwjsUciEngineClientStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  return defineStore('nwjsUciEngineClient', () => {
    async function initialiseEngine(engine: IAssignedEngine): Promise<void> {
      const processHandle = _requireProcessHandle(engine);
      const session = _initialiseAssignedEngineSession(engine);
      _attachToProcess(engine, processHandle, session);
      if (session.initialised) return;
      await _writeCommandAndWait(session, processHandle, 'uci', (line) => line === 'uciok');
      for (const [optionName, value] of Object.entries(engine.options)) await _writeCommand(processHandle, `setoption name ${optionName} value ${String(value)}`);
      await _writeCommandAndWait(session, processHandle, 'isready', (line) => line === 'readyok');
      session.initialised = true;
    }
    async function registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void> {
      _requireInitialisedSession(engine);
      await _writeCommand(_requireProcessHandle(engine), buildRegistrationCommand(request));
    }
    async function syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void> {
      const session = _requireInitialisedSession(engine);
      const processHandle = _requireProcessHandle(engine);
      if (!session.positionState || requiresNewGameBoundary(positionState)) {
        await _writeCommand(processHandle, 'ucinewgame');
        await _writeCommandAndWait(session, processHandle, 'isready', (line) => line === 'readyok');
      }
      session.positionState = structuredClone(positionState);
      await _writeCommand(processHandle, buildPositionCommand(positionState));
    }
    async function startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void> {
      if (request.searchMode !== EngineAnalysisSearchMode.Infinite) throw new Error(`Unsupported engine search mode: ${request.searchMode}.`);
      _requireInitialisedSession(engine);
      const runtimeState = _requireRuntimeState(engine);
      runtimeState.analysisCallback = onUpdate;
      runtimeState.analysisLines.clear();
      await _writeCommand(_requireProcessHandle(engine), `setoption name MultiPV value ${request.multiPv}`);
      await _writeCommand(_requireProcessHandle(engine), 'go infinite');
    }
    async function stopAnalysis(engine: IAssignedEngine): Promise<void> {
      _requireSession(engine);
      await _writeCommand(_requireProcessHandle(engine), 'stop');
    }
    async function startPlayerTurn(engine: IAssignedEngine): Promise<void> {
      const session = _requireInitialisedSession(engine);
      session.playerMoveDeferred = new Deferred<IMove>();
      await _writeCommand(_requireProcessHandle(engine), 'go');
    }
    async function awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
      const session = _requireSession(engine);
      if (!session.playerMoveDeferred) throw new Error(`No player turn is active for engine ${engine.displayName}.`);
      const movePromise = session.playerMoveDeferred;
      session.playerMoveDeferred = undefined;
      return movePromise;
    }
    async function stopEngine(engine: IAssignedEngine): Promise<void> {
      _requireProcessHandle(engine);
      const session = _getSession(engine);
      if (session) stopUciSession(session);
    }
    async function restartEngine(engine: IAssignedEngine): Promise<void> {
      await stopEngine(engine);
      await initialiseEngine(engine);
    }
    function requiresNewGameBoundary(positionState: IEnginePositionState): boolean {
      return positionState.requiresNewGameBoundary;
    }
    function _attachToProcess(engine: IAssignedEngine, processHandle: ProcessHandle, session: IUciSession): void {
      const runtimeState = _requireRuntimeAssignedEngine(engine).$;
      if (runtimeState.processHandle !== processHandle) throw _createInvalidProcessHandleError(`Engine process handle changed while initialising ${engine.displayName}.`);
      const process = _requireProcess(processHandle);
      if (session.process === process && session.detachProcessListeners) return;
      if (session.process || session.detachProcessListeners) stopUciSession(session, 'Engine process was restarted.');
      session.process = process;
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (session.isStopping) return;
        const error = _createPlatformError(PlatformErrorKind.UnexpectedExit, 'engineClient', `Engine exited unexpectedly for ${engine.displayName}.`, `code=${code ?? 'null'} signal=${signal ?? 'null'}`);
        failUciSession(session, error);
      };
      session.detachProcessListeners = attachProcessLineListeners(process, (line) => _consumeLine(engine, session, line), onExit);
    }
    function _consumeLine(engine: IAssignedEngine, session: IUciSession, line: string): void {
      if (line.length === 0) return;
      const waiterIndex = session.waiters.findIndex((waiter) => waiter.predicate(line));
      if (waiterIndex >= 0) {
        const [waiter] = session.waiters.splice(waiterIndex, 1);
        waiter!.resolve(line);
        return;
      }
      const runtimeState = _requireRuntimeState(engine);
      if (session.positionState && session.playerMoveDeferred) {
        const bestMove = parseBestMoveLine(session.positionState.currentPosition, line);
        if (bestMove) session.playerMoveDeferred.resolve(bestMove);
        return;
      }
      if (session.positionState && runtimeState.analysisCallback) {
        const parsedInfo = parseInfoLine(session.positionState.currentPosition, line);
        if (parsedInfo) {
          runtimeState.analysisLines.set(parsedInfo.multiPv, parsedInfo.analysisLine);
          runtimeState.analysisCallback(_buildAnalysisUpdate(session.positionState, runtimeState.analysisLines, false, undefined));
          return;
        }
        const analysisBestMove = parseBestMoveLine(session.positionState.currentPosition, line);
        if (analysisBestMove) {
          runtimeState.analysisCallback(_buildAnalysisUpdate(session.positionState, runtimeState.analysisLines, true, analysisBestMove));
          return;
        }
      }
    }
    function _buildAnalysisUpdate(positionState: IEnginePositionState, analysisLines: Map<number, IAnalysisLine>, isFinal: boolean, bestMove: IMove | undefined): IEngineAnalysisUpdate {
      const lines = [...analysisLines.entries()].sort((left, right) => left[0] - right[0]).map(([, line]) => line);
      return { position: structuredClone(positionState.currentPosition), positionKey: PositionIdentityService.buildPositionKey(positionState.currentPosition), bestMove: bestMove ?? lines[0]?.pv[0], lines, isFinal };
    }
    function _waitForLine(session: IUciSession, predicate: (line: string) => boolean): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        session.waiters.push({ predicate, resolve, reject } satisfies IUciLineWaiter);
      });
    }
    async function _writeCommandAndWait(session: IUciSession, processHandle: ProcessHandle, command: string, predicate: (line: string) => boolean): Promise<string> {
      const linePromise = _waitForLine(session, predicate);
      await _writeCommand(processHandle, command);
      return linePromise;
    }
    async function _writeCommand(processHandle: ProcessHandle | undefined, command: string): Promise<void> {
      if (!processHandle) throw _createInvalidProcessHandleError('Engine process handle is unavailable.');
      const process = _requireProcess(processHandle);
      await writeProcessLine(process, processHandle, command);
    }
    function _requireProcessHandle(engine: IAssignedEngine): ProcessHandle {
      const processHandle = _requireRuntimeAssignedEngine(engine).$.processHandle;
      if (!processHandle) throw _createInvalidProcessHandleError(`Engine process handle is unavailable for ${engine.displayName}.`);
      return processHandle;
    }
    function _requireProcess(processHandle: ProcessHandle | undefined): ISpawnedProcess {
      if (!processHandle) throw _createInvalidProcessHandleError('Engine process handle is unavailable.');
      const process = processRegistry.get(processHandle);
      if (process !== undefined) return process;
      throw _createInvalidProcessHandleError(`Engine process handle is no longer valid: ${processHandle}.`);
    }
    function _requireSession(engine: IAssignedEngine): IUciSession {
      const session = _getSession(engine);
      if (session) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireInitialisedSession(engine: IAssignedEngine): IUciSession {
      const session = _requireSession(engine);
      if (session.initialised) return session;
      throw _createPlatformError(PlatformErrorKind.ProcessStartFailed, 'engineClient', `Engine session is not initialised for ${engine.displayName}.`);
    }
    function _requireRuntimeState(engine: IAssignedEngine): IAssignedEngineRuntime {
      return _requireRuntimeAssignedEngine(engine).$;
    }
    function _getSession(engine: IAssignedEngine): IUciSession | undefined {
      const assignedUciEngine = _requireAssignedUciEngine(engine);
      return assignedUciEngine.$?.session;
    }

    return { initialiseEngine, registerEngine, syncPosition, startAnalysis, stopAnalysis, startPlayerTurn, awaitPlayerTurnMove, stopEngine, restartEngine, requiresNewGameBoundary } satisfies IEngineClient;
  });
}
