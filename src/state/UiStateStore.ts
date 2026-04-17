import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import { PlatformErrorKind, type IAppModalState, type IGameSessionSnapshot, type IUiLayoutState } from '@/contracts';
import { BuildConfig } from '@/config/BuildConfig';
import { SerializationService } from '@/domain';
import { logHandledError } from '@/utility/errors';

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
const settingsRoutePattern = /^\/settings\/(session|gameplay|appearance|engines)$/;
const gameRoutePattern = /^\/game\/(.+)$/;
const saveRoutePattern = /^\/saved-games\/save\/(.+)$/;
const loadSelectionRoutePattern = /^\/saved-games\/load\/(.+)$/;

function isGameRoute(route: string): route is `/game/${string}` {
  return gameRoutePattern.test(route);
}
function getGameRouteId(route: `/game/${string}`): string {
  return route.slice('/game/'.length);
}
function isValidCommittedRoute(route: string): route is IGameSessionSnapshot['activeRoute'] {
  return route === '/home'
    || route === '/saved-games/load'
    || settingsRoutePattern.test(route)
    || saveRoutePattern.test(route)
    || loadSelectionRoutePattern.test(route)
    || gameRoutePattern.test(route);
}
function coerceOpenGameIds(openGameIds: readonly string[], availableGameIds?: ReadonlySet<string>): string[] {
  const uniqueIds = [...new Set(openGameIds.filter((gameId) => gameId.length > 0))];
  if (!availableGameIds) return uniqueIds;
  return uniqueIds.filter((gameId) => availableGameIds.has(gameId));
}
function coerceActiveGameId(openGameIds: readonly string[], activeGameId?: string): string | undefined {
  if (activeGameId && openGameIds.includes(activeGameId)) return activeGameId;
  return openGameIds[0];
}
function selectFallbackRoute(openGameIds: readonly string[], activeGameId?: string): IGameSessionSnapshot['activeRoute'] {
  if (activeGameId && openGameIds.includes(activeGameId)) return `/game/${activeGameId}`;
  return '/home';
}
function validateGameRoute(route: IGameSessionSnapshot['activeRoute'], openGameIds: readonly string[]): IGameSessionSnapshot['activeRoute'] | undefined {
  if (!isGameRoute(route)) return route;
  const gameId = getGameRouteId(route);
  return openGameIds.includes(gameId) ? route : undefined;
}
function coerceActiveRoute(route: string, openGameIds: readonly string[], activeGameId?: string): IGameSessionSnapshot['activeRoute'] {
  if (!isValidCommittedRoute(route)) return selectFallbackRoute(openGameIds, activeGameId);
  if (isGameRoute(route)) return validateGameRoute(route, openGameIds) ?? selectFallbackRoute(openGameIds, activeGameId);
  return route;
}
function coerceGameSessionSnapshot(snapshot: IGameSessionSnapshot, availableGameIds?: ReadonlySet<string>): IGameSessionSnapshot {
  const openGameIds = coerceOpenGameIds(snapshot.openGameIds, availableGameIds);
  const activeGameId = coerceActiveGameId(openGameIds, snapshot.activeGameId);
  return {
    schemaVersion: snapshot.schemaVersion,
    openGameIds,
    activeGameId,
    activeRoute: coerceActiveRoute(snapshot.activeRoute, openGameIds, activeGameId),
  };
}

export const useUiStateStore = defineStore('uiStateStore', () => {
  const _gameSession = shallowRef<IGameSessionSnapshot>();
  const _layoutState = shallowRef<IUiLayoutState>();
  const _modalState = shallowRef<IAppModalState>();
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
