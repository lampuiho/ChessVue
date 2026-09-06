import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppModalKind,
  PauseReason,
  PlayerColour,
  TimeControlPreset,
  type IAppModalState,
  type IGame,
  type ISettingsSnapshot,
} from '@/contracts';
import { createClockSnapshot, createGame, createGameSessionSnapshot, createSettingsSnapshot, createUiLayoutState } from '@/state/__tests__/StateStoreTestUtility';
import GameView from '../GameView.vue';

interface ITestDependency {
  route: { params: { id: string } };
  router: { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
  gamesStore: {
    workspaceRevision: number;
    getGame: ReturnType<typeof vi.fn>;
    listGames: ReturnType<typeof vi.fn>;
    pauseGame: ReturnType<typeof vi.fn>;
    resumeGame: ReturnType<typeof vi.fn>;
  };
  settingsStore: { settings: ISettingsSnapshot };
  uiStateStore: {
    gameSession: ReturnType<typeof createGameSessionSnapshot>;
    layoutState: ReturnType<typeof createUiLayoutState>;
    modalState?: IAppModalState;
    showModal: (modal: IAppModalState) => void;
    hideModal: () => void;
  };
}

const dependency = vi.hoisted(() => ({})) as ITestDependency;
vi.mock('vue-router', () => ({
  useRoute: () => dependency.route,
  useRouter: () => dependency.router,
}));
vi.mock('@/state', () => ({
  useGamesStore: () => dependency.gamesStore,
  useSettingsStore: () => dependency.settingsStore,
  useUiStateStore: () => dependency.uiStateStore,
}));

const wrappers: VueWrapper[] = [];
let games: Map<string, IGame>;

function createTimedGame(id: string = 'game-1', pauseReasons: PauseReason[] = []): IGame {
  const game = createGame({
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 0 },
    clockSnapshot: createClockSnapshot(PlayerColour.White, true),
    $: { pauseReasons },
  });
  game.metadata.id = id;
  game.metadata.name = id;
  return game;
}
function mountView(game: IGame = createTimedGame()): VueWrapper {
  games.set(game.metadata.id, game);
  dependency.route.params.id = game.metadata.id;
  dependency.uiStateStore.gameSession = createGameSessionSnapshot({ openGameIds: [...games.keys()], activeGameId: game.metadata.id, activeRoute: `/game/${game.metadata.id}` });
  const wrapper = shallowMount(GameView);
  wrappers.push(wrapper);
  return wrapper;
}

describe('GameView menu interruptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    games = new Map();
    dependency.route = reactive({ params: { id: 'game-1' } });
    dependency.router = { push: vi.fn(async () => undefined), replace: vi.fn(async () => undefined) };
    dependency.gamesStore = {
      workspaceRevision: 0,
      getGame: vi.fn((id: string) => games.get(id)),
      listGames: vi.fn(() => [...games.values()]),
      pauseGame: vi.fn(async (game: IGame, reason: PauseReason) => {
        game.$ ??= {};
        game.$.pauseReasons = [...new Set([...(game.$.pauseReasons ?? []), reason])];
      }),
      resumeGame: vi.fn(async (game: IGame, reason: PauseReason) => {
        if (!game.$?.pauseReasons?.includes(reason)) return;
        game.$.pauseReasons = game.$.pauseReasons.filter((candidate) => candidate !== reason);
      }),
    };
    dependency.settingsStore = reactive({ settings: createSettingsSnapshot() });
    dependency.uiStateStore = reactive({
      gameSession: createGameSessionSnapshot(),
      layoutState: createUiLayoutState(),
      modalState: undefined,
      showModal: vi.fn((modal: IAppModalState) => dependency.uiStateStore.modalState = modal),
      hideModal: vi.fn(() => dependency.uiStateStore.modalState = undefined),
    });
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });

  it.each([
    ['homeRequested', '/home'],
    ['loadGameRequested', '/saved-games/load'],
    ['saveGameRequested', '/saved-games/save/game-1'],
    ['settingsRequested', '/settings/session'],
  ])('pauses before handling the %s route action', async (eventName, targetRoute) => {
    const game = createTimedGame();
    const wrapper = mountView(game);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit(eventName);
    await flushPromises();

    expect(dependency.gamesStore.pauseGame).toHaveBeenCalledWith(game, PauseReason.Menu);
    expect(dependency.router.push).toHaveBeenCalledWith(targetRoute);
    expect(dependency.gamesStore.pauseGame.mock.invocationCallOrder[0]).toBeLessThan(dependency.router.push.mock.invocationCallOrder[0]!);
  });
  it('does not pause route actions when auto-pause is disabled', async () => {
    dependency.settingsStore.settings.gameSession.autoPauseOnMenu = false;
    const wrapper = mountView();
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('settingsRequested');
    await flushPromises();

    expect(dependency.gamesStore.pauseGame).not.toHaveBeenCalled();
    expect(dependency.router.push).toHaveBeenCalledWith('/settings/session');
  });
  it('resumes a returning menu-owned pause but preserves manual and analysis pause owners', async () => {
    const menuPausedGame = createTimedGame('menu-paused', [PauseReason.Menu]);
    mountView(menuPausedGame);
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(menuPausedGame, PauseReason.Menu);

    for (const reason of [PauseReason.Manual, PauseReason.Analysis]) {
      dependency.gamesStore.resumeGame.mockClear();
      mountView(createTimedGame(`${reason}-paused`, [reason]));
      await flushPromises();
      expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalled();
    }
  });
  it('resumes when custom-new is cancelled', async () => {
    const game = createTimedGame();
    const wrapper = mountView(game);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('customNewGameRequested');
    await flushPromises();
    expect(dependency.uiStateStore.modalState?.kind).toBe(AppModalKind.NewGame);
    expect(dependency.gamesStore.pauseGame).toHaveBeenCalledWith(game, PauseReason.Menu);

    dependency.uiStateStore.hideModal();
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(game, PauseReason.Menu);
  });
  it('keeps the interrupted game paused after custom-new creates another workspace', async () => {
    const interruptedGame = createTimedGame('game-1');
    const newGame = createTimedGame('game-2');
    games.set(newGame.metadata.id, newGame);
    const wrapper = mountView(interruptedGame);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('customNewGameRequested');
    await flushPromises();
    dependency.route.params.id = newGame.metadata.id;
    await flushPromises();
    dependency.uiStateStore.hideModal();
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);

    dependency.route.params.id = interruptedGame.metadata.id;
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);
  });
});
