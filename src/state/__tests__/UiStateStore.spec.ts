import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModalKind, PlayerColour, PlayerType, EngineAvailability, EngineClientType, EngineProtocol, PlatformErrorKind, type IAppModalState } from '@/contracts';

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

    await store.loadGameSession();
    expect(store.gameSession).toEqual(createGameSessionSnapshot());
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

    await store.loadGameSession();
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

    await Promise.all([store.loadGameSession(), store.loadLayoutState()]);
    expect(store.gameSession).toEqual({
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1',
    });
    store.togglePanel('analysis', false);
    store.setSectionCollapsed('history', true);
    store.setAnalysisEngineExpanded(1, false);
    expect(store.layoutState?.analysisEngineExpandedByIndex).toEqual([true, false]);
    store.showModal({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-1' } });
    expect(store.modalState).toEqual({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-1' } });
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
  it('retains engine-bearing modal state without cloning runtime callbacks', () => {
    const store = useUiStateStore();
    const modal = {
      kind: AppModalKind.AnalysisEngineSelection,
      payload: {
        gameId: 'game-1',
        currentAnalysisEngines: [{
          displayName: 'Engine',
          executablePath: 'engine.exe',
          clientType: EngineClientType.Uci,
          protocol: EngineProtocol.Uci,
          options: {},
          $: { availability: EngineAvailability.Ready, analysisCallback: () => undefined, analysisLines: new Map() },
        }],
      },
    } satisfies IAppModalState;

    store.showModal(modal);

    expect(store.modalState).toBe(modal);
  });
  it('publishes direct and commanded shell mutations to a mounted consumer', async () => {
    const store = useUiStateStore();
    await Promise.all([store.loadGameSession(), store.loadLayoutState()]);
    const wrapper = mount(defineComponent({
      setup: () => () => h('div', [
        h('span', { class: 'tabs' }, store.gameSession?.openGameIds.join(',') ?? 'loading'),
        h('span', { class: 'active-game' }, store.gameSession?.activeGameId ?? 'none'),
        h('span', { class: 'route' }, store.gameSession?.activeRoute ?? 'loading'),
        h('span', { class: 'panels' }, `${store.layoutState?.showHistoryPanel}/${store.layoutState?.showAnalysisPanel}`),
        h('span', { class: 'sections' }, `${store.layoutState?.historyCollapsed}/${store.layoutState?.analysisCollapsed}`),
        h('span', { class: 'engine-folds' }, store.layoutState?.analysisEngineExpandedByIndex.join(',') ?? 'loading'),
        h('span', { class: 'modal' }, store.modalState?.kind ?? 'none'),
      ]),
    }));

    store.openTab('game-1');
    await nextTick();
    expect(wrapper.get('.tabs').text()).toBe('game-1');
    expect(wrapper.get('.active-game').text()).toBe('game-1');
    expect(wrapper.get('.route').text()).toBe('/game/game-1');

    store.setActiveRoute('/settings/appearance');
    await nextTick();
    expect(wrapper.get('.route').text()).toBe('/settings/appearance');
    store.gameSession!.activeRoute = '/home';
    store.togglePanel('analysis', false);
    store.layoutState!.showHistoryPanel = false;
    store.setSectionCollapsed('history', true);
    store.setAnalysisEngineExpanded(0, false);
    store.showModal({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-1' } });
    await nextTick();
    expect(wrapper.get('.route').text()).toBe('/home');
    expect(wrapper.get('.panels').text()).toBe('false/false');
    expect(wrapper.get('.sections').text()).toBe('true/false');
    expect(wrapper.get('.engine-folds').text()).toBe('false');
    expect(wrapper.get('.modal').text()).toBe(AppModalKind.DeleteGame);

    store.closeTab('game-1');
    store.hideModal();
    await nextTick();
    expect(wrapper.get('.tabs').text()).toBe('');
    expect(wrapper.get('.active-game').text()).toBe('none');
    expect(wrapper.get('.modal').text()).toBe('none');
  });
  it('loads each persisted UI document once and rejects mutations before loading', async () => {
    const store = useUiStateStore();

    expect(() => store.openTab('game-1')).toThrow('UI game session must be loaded');
    expect(() => store.togglePanel('history')).toThrow('UI layout state must be loaded');
    await Promise.all([store.loadGameSession(), store.loadGameSession(), store.loadLayoutState(), store.loadLayoutState()]);

    expect(domain.SerializationService.readGameSessionDocument).toHaveBeenCalledTimes(1);
    expect(domain.SerializationService.readUiLayoutDocument).toHaveBeenCalledTimes(1);
  });
  it('initialises each dialog explicitly without leaking the previous form or completion', async () => {
    const store = useUiStateStore();
    const closed = vi.fn(async () => {});
    const selection = { kind: AppModalKind.PlayerSelection, payload: { gameId: 'game-1', colour: PlayerColour.Black, currentPlayerType: PlayerType.Engine } } as const;
    store.showModal(selection, closed);
    expect(store.modalForm.selectedPlayer).toBe('unchanged');
    const oldForm = store.modalForm;
    oldForm.errorMessage = 'Previous failure';
    oldForm.isWorking = true;
    store.showModal(selection);
    oldForm.errorMessage = 'Late previous failure';
    expect(store.modalForm).toEqual({ errorMessage: '', isWorking: false, selectedPlayer: 'unchanged', selectedEngineId: '' });
    await store.hideModal();
    await store.hideModal();
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('settles the captured dialog completion once when cancellation is repeated', async () => {
    const store = useUiStateStore();
    const closed = vi.fn(async () => {});
    store.showModal({ kind: AppModalKind.NewGame }, closed);
    await Promise.all([store.hideModal(), store.hideModal()]);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(store.modalState).toBeUndefined();
  });
  it('cancels dialog delivery when its store is disposed', () => {
    const store = useUiStateStore();
    const closed = vi.fn();
    store.showModal({ kind: AppModalKind.NewGame }, closed);
    const signal = store.getModalSignal();
    store.$dispose();
    expect(signal.aborted).toBe(true);
    expect(closed).not.toHaveBeenCalled();
  });
});
