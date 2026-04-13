import { defineStore } from 'pinia';

import { EngineAnalysisSearchMode, PlatformErrorKind, type IAnalysisLine, type IAssignedEngine, type IAssignedEngineRuntime, type IEngineAnalysisRequest, type IEnginePositionState, type IEngineRegistrationRequest, type IMove, type IPlatformError } from '@/contracts';
import { PositionIdentityService } from '@/domain';
import { Deferred } from '@/utility/async/Deferred';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

import type { IEngineAnalysisUpdate, IEngineClient, ProcessHandle } from '../contracts';
import { buildPositionCommand, buildRegistrationCommand, parseBestMoveLine, parseInfoLine } from '../utility/UciUtility';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';
import { attachProcessLineListeners, writeProcessLine } from './NwjsProcessLineUtility';

interface ILineWaiter {
  predicate(line: string): boolean;
  resolve(line: string): void;
  reject(error: unknown): void;
}
interface IUciSession {
  initialised: boolean;
  isStopping: boolean;
  process: ISpawnedProcess | null;
  positionState: IEnginePositionState | null;
  analysisCallback: ((update: IEngineAnalysisUpdate) => void) | null;
  analysisLines: Map<number, IAnalysisLine>;
  playerMoveDeferred: Deferred<IMove> | null;
  waiters: ILineWaiter[];
  detachProcessListeners: (() => void) | null;
}
interface IAssignedUciEngineRuntime extends IAssignedEngineRuntime {
  session: IUciSession;
}
type IRuntimeAssignedEngine = IAssignedEngine & {
  $: IAssignedEngineRuntime;
};
type IAssignedUciEngine = IAssignedEngine & { $: IAssignedUciEngineRuntime; };
function createPlatformError(kind: PlatformErrorKind, operation: string, message: string, detail: string | null = null): IPlatformError {
  return { kind, operation, message, detail };
}
function createSession(): IUciSession {
  return {
    initialised: false,
    isStopping: false,
    process: null,
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
      session.playerMoveDeferred = new Deferred<IMove>();
      await _writeCommand(_requireProcessHandle(engine), 'go');
    }
    async function awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove> {
      const session = _requireSession(engine);
      if (session.playerMoveDeferred === null) throw new Error(`No player turn is active for engine ${engine.displayName}.`);
      const movePromise = session.playerMoveDeferred;
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
      session.detachProcessListeners = attachProcessLineListeners(process, (line) => _consumeLine(session, line), onExit);
    }
    function _detachProcess(session: IUciSession): void {
      session.detachProcessListeners?.();
      session.detachProcessListeners = null;
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
      await writeProcessLine(process, processHandle!, command);
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
