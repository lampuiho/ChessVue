import type { ResolvedThemeMode } from '@/contracts/Appearance';
import { EngineClientType, type IAssignedEngine, type IEngineAnalysisRequest, type IEngineAnalysisUpdate, type IEnginePositionState, type IEngineRegistrationRequest, type ProcessHandle } from '@/contracts/Engine';
import type { IMove } from '@/contracts/Move';
import type { IPlatformError } from '@/contracts/PlatformError';

export type { IEngineAnalysisUpdate, ProcessHandle };
export { EngineClientType };
export const enum PlatformEventKey {
  AppCloseRequested = 'appCloseRequested',
  AppFocusReturned = 'appFocusReturned',
  SystemThemeChanged = 'systemThemeChanged',
}
export interface IPlatformEventRegistration {
  registrationId: string;
  eventKey: PlatformEventKey;
  owner: string;
  debugLabel?: string;
  registeredAtUtc: string;
}
export interface IFileSystemEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  lastModifiedUtc?: string;
}
export interface IStorageAdapter {
  showSaveDialog(suggestedPath?: string): Promise<string>;
  showOpenDialog(startDirectory?: string): Promise<string>;
  listDirectory(path: string): Promise<IFileSystemEntry[]>;
  ensureDirectory(path: string): Promise<void>;
  writeTextFile(path: string, raw: string, overwrite?: boolean): Promise<void>;
  readTextFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
export interface IProcessManager {
  spawnProcess(executablePath: string, args?: string[]): Promise<ProcessHandle>;
  subscribeToUnexpectedExit(processHandle: ProcessHandle, onUnexpectedExit: (error: IPlatformError) => void): () => void;
  stopProcess(processHandle: ProcessHandle): Promise<void>;
  restartProcess(processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle>;
}
export interface ISystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode;
}
export interface IEngineClient {
  /** Mutates engine.$ by attaching or updating the platform runtime session and marking it initialised. */
  initialiseEngine(engine: IAssignedEngine): Promise<void>;
  /** Requires engine.$ to already hold an initialised session; does not initialise the engine. */
  registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void>;
  /** Mutates engine.$ by updating the cached session position state. */
  syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>;
  /** Mutates engine.$ by replacing the active analysis callback and clearing cached analysis lines. */
  startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>;
  stopAnalysis(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by creating a new pending player-move state. */
  startPlayerTurn(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by consuming and clearing the pending player-move state. */
  awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
  /** Mutates engine.$ by clearing session initialisation, position, analysis, waiter, and player-move state. */
  stopEngine(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by clearing prior session state and then reinitialising it. */
  restartEngine(engine: IAssignedEngine): Promise<void>;
  requiresNewGameBoundary(positionState: IEnginePositionState): boolean;
}
export interface IPlatformService {
  getStorageAdapter(): IStorageAdapter;
  getProcessManager(): IProcessManager;
  getSystemThemeAdapter(): ISystemThemeAdapter;
  getEngineClient(engineClientType: EngineClientType): IEngineClient;
  subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void;
  subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void;
  subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void;
  getEventRegistrationSnapshot(): IPlatformEventRegistration[];
}
