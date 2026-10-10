import { defineStore } from 'pinia';
import { ref, shallowRef, toRaw } from 'vue';

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
  const gameSession = ref<IGameSessionSnapshot>();
  const layoutState = ref<IUiLayoutState>();
  const modalState = shallowRef<IAppModalState>();
  const recoveryWarnings = ref<string[]>([]);
  function addRecoveryWarning(message: string): void {
    recoveryWarnings.value.push(message);
  }
  let _gameSessionPromise: Promise<void> | undefined;
  let _layoutStatePromise: Promise<void> | undefined;

  function _requireGameSession(): IGameSessionSnapshot {
    if (!gameSession.value) throw new Error('UI game session must be loaded before it is changed.');
    return gameSession.value;
  }
  function _requireLayoutState(): IUiLayoutState {
    if (!layoutState.value) throw new Error('UI layout state must be loaded before it is changed.');
    return layoutState.value;
  }
  async function loadGameSession(): Promise<void> {
    if (gameSession.value) return;
    if (_gameSessionPromise) return _gameSessionPromise;
    _gameSessionPromise = (async () => {
      try {
        gameSession.value = coerceGameSessionSnapshot(await SerializationService.readGameSessionDocument(BuildConfig.persistence.gameSessionPath));
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'kind' in error && (error as { kind?: unknown }).kind === PlatformErrorKind.NotFound)) {
          logHandledError('UiStateStore', 'readGameSessionDocument', error);
          addRecoveryWarning('The previous session could not be read. Open saved games to recover a saved board.');
        }
        gameSession.value = createDefaultGameSession();
      }
    })();
    return _gameSessionPromise;
  }
  async function saveGameSession(): Promise<void> {
    await loadGameSession();
    await SerializationService.writeGameSessionDocument(BuildConfig.persistence.gameSessionPath, toRaw(_requireGameSession()));
  }
  async function loadLayoutState(): Promise<void> {
    if (layoutState.value) return;
    if (_layoutStatePromise) return _layoutStatePromise;
    _layoutStatePromise = (async () => {
      try {
        layoutState.value = await SerializationService.readUiLayoutDocument(BuildConfig.persistence.layoutStatePath);
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'kind' in error && (error as { kind?: unknown }).kind === PlatformErrorKind.NotFound)) {
          logHandledError('UiStateStore', 'readUiLayoutDocument', error);
          addRecoveryWarning('The saved layout could not be read. The default layout is in use.');
        }
        layoutState.value = createDefaultLayoutState();
      }
    })();
    return _layoutStatePromise;
  }
  async function saveLayoutState(): Promise<void> {
    await loadLayoutState();
    await SerializationService.writeUiLayoutDocument(BuildConfig.persistence.layoutStatePath, toRaw(_requireLayoutState()));
  }
  function setActiveRoute(route: IGameSessionSnapshot['activeRoute']): void {
    _requireGameSession().activeRoute = route;
  }
  function setActiveGame(gameId?: string): void {
    const currentSnapshot = _requireGameSession();
    currentSnapshot.activeGameId = gameId && currentSnapshot.openGameIds.includes(gameId) ? gameId : undefined;
    if (currentSnapshot.activeGameId) {
      currentSnapshot.activeRoute = `/game/${currentSnapshot.activeGameId}`;
      return;
    }
    currentSnapshot.activeRoute = coerceActiveRoute(currentSnapshot.activeRoute, currentSnapshot.openGameIds, currentSnapshot.activeGameId);
  }
  function openTab(gameId: string): void {
    const currentSnapshot = _requireGameSession();
    currentSnapshot.openGameIds = coerceOpenGameIds([...currentSnapshot.openGameIds, gameId]);
    currentSnapshot.activeGameId = gameId;
    currentSnapshot.activeRoute = `/game/${gameId}`;
  }
  function closeTab(gameId: string): void {
    const currentSnapshot = _requireGameSession();
    currentSnapshot.openGameIds = currentSnapshot.openGameIds.filter((candidate) => candidate !== gameId);
    if (currentSnapshot.activeGameId === gameId) currentSnapshot.activeGameId = undefined;
    currentSnapshot.activeGameId = coerceActiveGameId(currentSnapshot.openGameIds, currentSnapshot.activeGameId);
    currentSnapshot.activeRoute = coerceActiveRoute(currentSnapshot.activeRoute, currentSnapshot.openGameIds, currentSnapshot.activeGameId);
  }
  function setLayoutState(layout: IUiLayoutState): void {
    layoutState.value = layout;
  }
  function togglePanel(panel: 'history' | 'analysis', isVisible?: boolean): void {
    const currentLayout = _requireLayoutState();
    if (panel === 'history') currentLayout.showHistoryPanel = isVisible ?? !currentLayout.showHistoryPanel;
    if (panel === 'analysis') currentLayout.showAnalysisPanel = isVisible ?? !currentLayout.showAnalysisPanel;
  }
  function setSectionCollapsed(section: 'history' | 'analysis', isCollapsed?: boolean): void {
    const currentLayout = _requireLayoutState();
    if (section === 'history') currentLayout.historyCollapsed = isCollapsed ?? !currentLayout.historyCollapsed;
    if (section === 'analysis') currentLayout.analysisCollapsed = isCollapsed ?? !currentLayout.analysisCollapsed;
  }
  function showModal(modal: IAppModalState): void {
    modalState.value = modal;
  }
  function hideModal(): void {
    modalState.value = undefined;
  }
  function setAnalysisEngineExpanded(index: number, isExpanded?: boolean): void {
    const currentLayout = _requireLayoutState();
    while (currentLayout.analysisEngineExpandedByIndex.length <= index) currentLayout.analysisEngineExpandedByIndex.push(true);
    currentLayout.analysisEngineExpandedByIndex[index] = isExpanded ?? !currentLayout.analysisEngineExpandedByIndex[index];
  }

  return {
    gameSession,
    layoutState,
    modalState,
    recoveryWarnings,
    addRecoveryWarning,
    loadGameSession,
    saveGameSession,
    loadLayoutState,
    saveLayoutState,
    setActiveRoute,
    setActiveGame,
    openTab,
    closeTab,
    setLayoutState,
    togglePanel,
    setSectionCollapsed,
    showModal,
    hideModal,
    setAnalysisEngineExpanded,
  };
});
