import type { IAnalysisLine } from '@/contracts/Analysis';
import type { ResolvedThemeMode } from '@/contracts/Appearance';
import type { IBoardPosition } from '@/contracts/ChessboardState';
import type { IAssignedEngine, IEngineAnalysisRequest, IEnginePositionState, IEngineRegistrationRequest } from '@/contracts/Engine';
import type { IMove } from '@/contracts/Move';
import type { IPlatformError } from '@/contracts/PlatformError';

export type ProcessHandle = string;
export enum EngineClientType {
  Uci = 'uci',
}
export const enum PlatformEventKey {
  AppCloseRequested = 'appCloseRequested',
  AppFocusReturned = 'appFocusReturned',
  SystemThemeChanged = 'systemThemeChanged',
}
export interface IPlatformEventRegistration {
  registrationId: string;
  eventKey: PlatformEventKey;
  owner: string;
  debugLabel: string | null;
  registeredAtUtc: string;
}
export interface IFileSystemEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  lastModifiedUtc: string | null;
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
export interface IEngineAnalysisUpdate {
  position: IBoardPosition;
  positionKey: string;
  bestMove: IMove | null;
  lines: IAnalysisLine[];
  isFinal: boolean;
}
export interface IEngineClient {
  initialiseEngine(engine: IAssignedEngine): Promise<void>;
  registerEngine(engine: IAssignedEngine, request: IEngineRegistrationRequest): Promise<void>;
  syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>;
  startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>;
  stopAnalysis(engine: IAssignedEngine): Promise<void>;
  startPlayerTurn(engine: IAssignedEngine): Promise<void>;
  awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
  stopEngine(engine: IAssignedEngine): Promise<void>;
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
