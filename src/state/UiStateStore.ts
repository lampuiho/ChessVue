import { defineStore } from 'pinia';
import { ref } from 'vue';

import { PlatformErrorKind, type IAppModalState, type IGameSessionSnapshot, type IUiLayoutState } from '@/contracts';
import { BuildConfig } from '@/config/BuildConfig';
import { SerializationService } from '@/domain';
import { coerceGameSessionSnapshot, logHandledError } from '@/utility/state';

function createDefaultGameSession(): IGameSessionSnapshot {
  return {
    schemaVersion: 1,
    openGameIds: [],
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

export const useUiStateStore = defineStore('uiStateStore', () => {
  const _gameSession = ref<IGameSessionSnapshot>();
  const _layoutState = ref<IUiLayoutState>();
  const _modalState = ref<IAppModalState>();
  let _gameSessionPromise: Promise<IGameSessionSnapshot> | undefined;
  let _layoutStatePromise: Promise<IUiLayoutState> | undefined;

  function _getGameSession(): IGameSessionSnapshot {
    return structuredClone(_gameSession.value ?? createDefaultGameSession());
  }
  function _getLayoutState(): IUiLayoutState {
    return structuredClone(_layoutState.value ?? createDefaultLayoutState());
  }
  async function getGameSessionOrDefault(): Promise<IGameSessionSnapshot> {
    if (_gameSession.value) return _getGameSession();
    if (_gameSessionPromise) return _gameSessionPromise;
    _gameSessionPromise = (async () => {
      try {
        _gameSession.value = coerceGameSessionSnapshot(await SerializationService.readGameSessionDocument(BuildConfig.persistence.gameSessionPath));
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'kind' in error && (error as { kind?: unknown }).kind === PlatformErrorKind.NotFound)) logHandledError('UiStateStore', 'readGameSessionDocument', error);
        _gameSession.value = createDefaultGameSession();
      }
      return _getGameSession();
    })();
    return _gameSessionPromise;
  }
  async function saveGameSession(): Promise<void> {
    await getGameSessionOrDefault();
    await SerializationService.writeGameSessionDocument(BuildConfig.persistence.gameSessionPath, _getGameSession());
  }
  async function getLayoutStateOrDefault(): Promise<IUiLayoutState> {
    if (_layoutState.value) return _getLayoutState();
    if (_layoutStatePromise) return _layoutStatePromise;
    _layoutStatePromise = (async () => {
      try {
        _layoutState.value = await SerializationService.readUiLayoutDocument(BuildConfig.persistence.layoutStatePath);
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'kind' in error && (error as { kind?: unknown }).kind === PlatformErrorKind.NotFound)) logHandledError('UiStateStore', 'readUiLayoutDocument', error);
        _layoutState.value = createDefaultLayoutState();
      }
      return _getLayoutState();
    })();
    return _layoutStatePromise;
  }
  async function saveLayoutState(): Promise<void> {
    await getLayoutStateOrDefault();
    await SerializationService.writeUiLayoutDocument(BuildConfig.persistence.layoutStatePath, _getLayoutState());
  }
  function setActiveRoute(route: IGameSessionSnapshot['activeRoute']): void {
    _gameSession.value = { ..._getGameSession(), activeRoute: route };
  }
  function setActiveGame(gameId?: string): void {
    const currentSnapshot = _getGameSession();
    const openGameIds = gameId && !currentSnapshot.openGameIds.includes(gameId) ? [...currentSnapshot.openGameIds, gameId] : currentSnapshot.openGameIds;
    _gameSession.value = coerceGameSessionSnapshot({ ...currentSnapshot, openGameIds, activeGameId: gameId });
  }
  function openTab(gameId: string): void {
    const currentSnapshot = _getGameSession();
    _gameSession.value = coerceGameSessionSnapshot({
      ...currentSnapshot,
      openGameIds: [...currentSnapshot.openGameIds, gameId],
      activeGameId: gameId,
      activeRoute: `/game/${gameId}`,
    });
  }
  function closeTab(gameId: string): void {
    const currentSnapshot = _getGameSession();
    _gameSession.value = coerceGameSessionSnapshot({
      ...currentSnapshot,
      openGameIds: currentSnapshot.openGameIds.filter((candidate) => candidate !== gameId),
      activeGameId: currentSnapshot.activeGameId === gameId ? undefined : currentSnapshot.activeGameId,
    });
  }
  function setLayoutState(layout: IUiLayoutState): void {
    _layoutState.value = structuredClone(layout);
  }
  function togglePanel(panel: 'history' | 'analysis', isVisible?: boolean): void {
    const currentLayout = _getLayoutState();
    if (panel === 'history') currentLayout.showHistoryPanel = isVisible ?? !currentLayout.showHistoryPanel;
    if (panel === 'analysis') currentLayout.showAnalysisPanel = isVisible ?? !currentLayout.showAnalysisPanel;
    _layoutState.value = currentLayout;
  }
  function setSectionCollapsed(section: 'history' | 'analysis', isCollapsed?: boolean): void {
    const currentLayout = _getLayoutState();
    if (section === 'history') currentLayout.historyCollapsed = isCollapsed ?? !currentLayout.historyCollapsed;
    if (section === 'analysis') currentLayout.analysisCollapsed = isCollapsed ?? !currentLayout.analysisCollapsed;
    _layoutState.value = currentLayout;
  }
  function getModalState(): IAppModalState | undefined {
    return _modalState.value ? structuredClone(_modalState.value) : undefined;
  }
  function showModal(modal: IAppModalState): void {
    _modalState.value = structuredClone(modal);
  }
  function hideModal(): void {
    _modalState.value = undefined;
  }
  function getAnalysisEngineExpandedByIndex(): boolean[] {
    return [..._getLayoutState().analysisEngineExpandedByIndex];
  }
  function setAnalysisEngineExpanded(index: number, isExpanded?: boolean): void {
    const currentLayout = _getLayoutState();
    while (currentLayout.analysisEngineExpandedByIndex.length <= index) currentLayout.analysisEngineExpandedByIndex.push(true);
    currentLayout.analysisEngineExpandedByIndex[index] = isExpanded ?? !currentLayout.analysisEngineExpandedByIndex[index];
    _layoutState.value = currentLayout;
  }

  return {
    getGameSessionOrDefault,
    saveGameSession,
    getLayoutStateOrDefault,
    saveLayoutState,
    setActiveRoute,
    setActiveGame,
    openTab,
    closeTab,
    setLayoutState,
    togglePanel,
    setSectionCollapsed,
    getModalState,
    showModal,
    hideModal,
    getAnalysisEngineExpandedByIndex,
    setAnalysisEngineExpanded,
  };
});
