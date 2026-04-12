import { PlatformErrorKind, type IGameSessionSnapshot, type IPlatformError, type IUiLayoutState } from '@/contracts';
import { usePlatformService } from '@/platform';

import { SerializationService } from './SerializationService';

const _gameSessionPath = 'game-session.json';
const _layoutStatePath = 'layout-state.json';

function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}
function createDefaultGameSessionSnapshot(): IGameSessionSnapshot {
  return {
    schemaVersion: 1,
    openGameIds: [],
    activeGameId: null,
    activeRoute: '/home',
  };
}
function createDefaultLayoutState(): IUiLayoutState {
  return {
    schemaVersion: 1,
    showHistoryPanel: true,
    showAnalysisPanel: true,
    historyCollapsed: false,
    analysisCollapsed: false,
    analysisEngineExpandedByIndex: [],
  };
}

export const SessionStateService = {
  async getGameSessionOrDefault(): Promise<IGameSessionSnapshot> {
    const storageAdapter = usePlatformService().getStorageAdapter();
    try {
      return SerializationService.deserialiseGameSession(await storageAdapter.readTextFile(_gameSessionPath));
    } catch (error) {
      if (isPlatformError(error) && error.kind === PlatformErrorKind.NotFound) return createDefaultGameSessionSnapshot();
      console.error('[SessionStateService] Falling back to default game session.', error);
      return createDefaultGameSessionSnapshot();
    }
  },
  async saveGameSession(snapshot: IGameSessionSnapshot): Promise<void> {
    const raw = SerializationService.serialiseGameSession(snapshot);
    await usePlatformService().getStorageAdapter().writeTextFile(_gameSessionPath, raw, true);
  },
  async getLayoutStateOrDefault(): Promise<IUiLayoutState> {
    const storageAdapter = usePlatformService().getStorageAdapter();
    try {
      return SerializationService.deserialiseUiLayoutState(await storageAdapter.readTextFile(_layoutStatePath));
    } catch (error) {
      if (isPlatformError(error) && error.kind === PlatformErrorKind.NotFound) return createDefaultLayoutState();
      console.error('[SessionStateService] Falling back to default layout state.', error);
      return createDefaultLayoutState();
    }
  },
  async saveLayoutState(state: IUiLayoutState): Promise<void> {
    const raw = SerializationService.serialiseUiLayoutState(state);
    await usePlatformService().getStorageAdapter().writeTextFile(_layoutStatePath, raw, true);
  },
};
