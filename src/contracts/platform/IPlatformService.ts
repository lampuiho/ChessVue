import type { ResolvedThemeMode } from '../Appearance';
import { EngineClientType } from '../Engine';
import type { IEngineClient } from './IEngineClient';
import type { IPlatformEventRegistration } from './IPlatformEventRegistration';
import type { IProcessManager } from './IProcessManager';
import type { IStorageAdapter } from './IStorageAdapter';
import type { ISystemThemeAdapter } from './ISystemThemeAdapter';

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
