import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModalKind, PlatformErrorKind } from '@/contracts';

import {
  createGameSessionSnapshot,
  createPlatformError,
  createUiLayoutState,
  rejectWithRandomDelay,
  resolveWithRandomDelay,
} from './StateStoreTestUtility';

let useUiStateStore: typeof import('..').useUiStateStore;
let storedGameSession = createGameSessionSnapshot();
let storedLayoutState = createUiLayoutState();
const domain = {
  SerializationService: {
    readGameSessionDocument: vi.fn(async () => resolveWithRandomDelay(storedGameSession)),
    writeGameSessionDocument: vi.fn(async (_path: string, snapshot: typeof storedGameSession) => {
      storedGameSession = structuredClone(snapshot);
      await resolveWithRandomDelay(undefined);
    }),
    readUiLayoutDocument: vi.fn(async () => resolveWithRandomDelay(storedLayoutState)),
    writeUiLayoutDocument: vi.fn(async (_path: string, layout: typeof storedLayoutState) => {
      storedLayoutState = structuredClone(layout);
      await resolveWithRandomDelay(undefined);
    }),
  },
};

describe('useUiStateStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    storedGameSession = createGameSessionSnapshot();
    storedLayoutState = createUiLayoutState();
    Object.values(domain.SerializationService).forEach((mock) => mock.mockClear());
    vi.doMock('@/domain', () => domain);
    ({ useUiStateStore } = await import('..'));
  });

  it('falls back to defaults, manages open tabs, and persists the coerced session snapshot', async () => {
    domain.SerializationService.readGameSessionDocument.mockImplementationOnce(async () => rejectWithRandomDelay(createPlatformError(PlatformErrorKind.NotFound, 'Missing game session')));
    const store = useUiStateStore();

    expect(await store.getGameSessionOrDefault()).toEqual(createGameSessionSnapshot());
    store.openTab('game-1');
    store.openTab('game-2');
    store.closeTab('game-1');
    store.setActiveRoute('/settings/appearance');
    await store.saveGameSession();

    expect(storedGameSession).toEqual({
      schemaVersion: 1,
      openGameIds: ['game-2'],
      activeGameId: 'game-2',
      activeRoute: '/settings/appearance',
    });
  });
  it('keeps setActiveGame selection-only and persists mutated session state', async () => {
    storedGameSession = createGameSessionSnapshot({
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1',
    });
    const store = useUiStateStore();

    await store.getGameSessionOrDefault();
    store.setActiveGame('missing');
    store.openTab('game-2');
    store.setActiveGame('game-1');
    await store.saveGameSession();

    expect(storedGameSession).toEqual({
      schemaVersion: 1,
      openGameIds: ['game-1', 'game-2'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1',
    });
  });

  it('coerces persisted routes and persists layout state with modal updates', async () => {
    storedGameSession = createGameSessionSnapshot({
      openGameIds: ['game-1'],
      activeGameId: 'missing',
      activeRoute: '/game/missing',
    });
    const store = useUiStateStore();

    expect(await store.getGameSessionOrDefault()).toEqual({
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1',
    });
    store.togglePanel('analysis', false);
    store.setSectionCollapsed('history', true);
    store.setAnalysisEngineExpanded(1, false);
    const expandedByIndex = store.getAnalysisEngineExpandedByIndex();
    expect(store.getAnalysisEngineExpandedByIndex()).toBe(expandedByIndex);
    store.showModal({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-1' } });
    expect(store.getModalState()).toEqual({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-1' } });
    store.hideModal();
    await store.saveLayoutState();

    expect(storedLayoutState).toEqual({
      schemaVersion: 1,
      showHistoryPanel: true,
      showAnalysisPanel: false,
      historyCollapsed: true,
      analysisCollapsed: false,
      analysisEngineExpandedByIndex: [true, false],
    });
  });
});
