import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppModalKind,
  EngineAvailability,
  GameState,
  PauseReason,
  PlayerColour,
  TimeControlPreset,
  type IAppModalState,
  type IGame,
  type ISettingsSnapshot,
} from '@/contracts';
import { createAnalysisSeat, createClockSnapshot, createGame, createGameSessionSnapshot, createSettingsSnapshot, createUiLayoutState } from '@/state/__tests__/StateStoreTestUtility';
import { createInitialBoardPosition } from '@/utility/chess';
import { MoveApplicationService } from '@/domain';
import GameView from '../GameView.vue';

interface ITestDependency {
  route: { params: { id: string } };
  router: { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
  gamesStore: {
    workspaceRevision: number;
    getGame: ReturnType<typeof vi.fn>;
    getTakeBackMoveCount: ReturnType<typeof vi.fn>;
    getVisibleAnalysis: ReturnType<typeof vi.fn>;
    listGames: ReturnType<typeof vi.fn>;
    pauseGame: ReturnType<typeof vi.fn>;
    resumeGame: ReturnType<typeof vi.fn>;
    onAutosaveFailed: ReturnType<typeof vi.fn>;
  };
  settingsStore: { settings: ISettingsSnapshot };
  uiStateStore: {
    gameSession: ReturnType<typeof createGameSessionSnapshot>;
    layoutState: ReturnType<typeof createUiLayoutState>;
    modalState?: IAppModalState;
    showModal: (modal: IAppModalState, onClosed?: () => Promise<void> | void) => void;
    hideModal: () => Promise<void>;
  };
}

const dependency = vi.hoisted(() => ({})) as ITestDependency;
vi.mock('vue-router', () => ({
  useRoute: () => dependency.route,
  useRouter: () => dependency.router,
  onBeforeRouteUpdate: (handler: (to: { params: { id: string } }) => unknown) => routeUpdates.push(handler),
  onBeforeRouteLeave: vi.fn(),
}));
vi.mock('@/state', () => ({
  useGamesStore: () => dependency.gamesStore,
  useSettingsStore: () => dependency.settingsStore,
  useUiStateStore: () => dependency.uiStateStore,
}));

const wrappers: VueWrapper[] = [];
const routeUpdates: Array<(to: { params: { id: string } }) => unknown> = [];
let modalClosed: (() => Promise<void> | void) | undefined;
let games: Map<string, IGame>;
async function selectRoute(id: string) {
  for (const update of routeUpdates) await update({ params: { id } });
  dependency.route.params.id = id;
  await flushPromises();
}

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
    routeUpdates.splice(0);
    modalClosed = undefined;
    dependency.route = reactive({ params: { id: 'game-1' } });
    dependency.router = { push: vi.fn(async () => undefined), replace: vi.fn(async () => undefined) };
    dependency.gamesStore = reactive({
      workspaceRevision: 0,
      onAutosaveFailed: vi.fn(() => () => {}),
      getGame: vi.fn((id: string) => games.get(id)),
      getTakeBackMoveCount: vi.fn(() => 0),
      getVisibleAnalysis: vi.fn((game: IGame) => ({ engineSeats: [...game.analysis.seats] })),
      listGames: vi.fn(() => [...games.values()]),
      pauseGame: vi.fn(async (game: IGame, reason: PauseReason) => {
        game.$ ??= {};
        game.$.pauseReasons = [...new Set([...(game.$.pauseReasons ?? []), reason])];
      }),
      resumeGame: vi.fn(async (game: IGame, reason: PauseReason) => {
        if (!game.$?.pauseReasons?.includes(reason)) return;
        game.$.pauseReasons = game.$.pauseReasons.filter((candidate) => candidate !== reason);
      }),
    });
    dependency.settingsStore = reactive({ settings: createSettingsSnapshot() });
    dependency.uiStateStore = reactive({
      gameSession: createGameSessionSnapshot(),
      layoutState: createUiLayoutState(),
      modalState: undefined,
      showModal: vi.fn((modal: IAppModalState, onClosed?: () => Promise<void> | void) => {
        dependency.uiStateStore.modalState = modal;
        modalClosed = onClosed;
      }),
      hideModal: vi.fn(async () => {
        dependency.uiStateStore.modalState = undefined;
        const closed = modalClosed;
        modalClosed = undefined;
        await closed?.();
      }),
    });
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });
  it('publishes raw seat changes through workspaceRevision and allows paused runtime controls', async () => {
    const game = createTimedGame();
    game.gameState = GameState.PausedWhiteTurn;
    const seat = createAnalysisSeat();
    game.analysis.seats = [seat];
    const wrapper = mountView(game);
    await flushPromises();
    const panel = wrapper.getComponent({ name: 'AnalysisPanel' });
    const previousSeats = panel.props('seats');
    expect(panel.props('disabled')).toBe(true);
    expect(panel.props('startDisabled')).toBe(false);
    seat.assignedEngine.$ = { availability: EngineAvailability.Failed, lastError: 'Startup failed', analysisLines: new Map() };
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(panel.props('seats')).not.toBe(previousSeats);
    expect(panel.props('seats')[0].assignedEngine.$.lastError).toBe('Startup failed');
    game.gameState = GameState.BoardEdit;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(panel.props('startDisabled')).toBe(true);
  });
  it('preserves board input across analysis publications but replaces the position after a board edit', async () => {
    const game = createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    const wrapper = mountView(game);
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const original = board.props('position');
    game.analysis.seats = [createAnalysisSeat()];
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(board.props('position')).toBe(original);
    MoveApplicationService.deletePiece(game.rootPosition, 12);
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(board.props('position')).not.toBe(original);
    expect(board.props('position').board[12]).toBeUndefined();
  });
  it('replaces board input when switching to another game with the same position', async () => {
    const wrapper = mountView();
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const original = board.props('position');
    const other = createTimedGame('game-2');
    games.set(other.metadata.id, other);
    await selectRoute(other.metadata.id);
    expect(board.props('position')).toEqual(original);
    expect(board.props('position')).not.toBe(original);
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
    await selectRoute(newGame.metadata.id);
    dependency.uiStateStore.hideModal();
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);

    await selectRoute(interruptedGame.metadata.id);
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);
  });
});
