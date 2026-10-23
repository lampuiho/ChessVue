import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineAvailability,
  GameState,
  PauseReason,
  PlayerColour,
  ResultState,
  TimeControlPreset,
  type IGame,
  type ISettingsSnapshot,
} from '@/contracts';
import { createAnalysisSeat, createClockSnapshot, createGame, createGameSessionSnapshot, createSettingsSnapshot, createUiLayoutState } from '@/state/__tests__/StateStoreTestUtility';
import { createInitialBoardPosition, toDetailedMove } from '@/utility/chess';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import GameView from '../GameView.vue';
import ConfirmationModal from '@/components/modals/ConfirmationModal.vue';
import type { ModalProps } from '@/composables/ModalComposable';
import GameCreationModal from '@/components/modals/GameCreationModal.vue';
import { ClockTimestamp } from '@/utility/date';

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
    makeMove: ReturnType<typeof vi.fn>;
    enterInGameAnalysis: ReturnType<typeof vi.fn>;
    exitInGameAnalysis: ReturnType<typeof vi.fn>;
  };
  settingsStore: { settings: ISettingsSnapshot };
  uiStateStore: {
    gameSession: ReturnType<typeof createGameSessionSnapshot>;
    layoutState: ReturnType<typeof createUiLayoutState>;
  };
}

const dependency = vi.hoisted(() => ({})) as ITestDependency;
const modal = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/composables/ModalComposable', () => ({ useModal: () => modal }));
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
let closeModal: () => Promise<void>;
let games: Map<string, IGame>;
async function _selectRoute(id: string) {
  for (const update of routeUpdates) await update({ params: { id } });
  dependency.route.params.id = id;
  await flushPromises();
}

function _createTimedGame(id: string = 'game-1', pauseReasons: PauseReason[] = []): IGame {
  const game = createGame({
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 0 },
    clockSnapshot: createClockSnapshot(PlayerColour.White, true),
    $: { pauseReasons },
  });
  game.metadata.id = id;
  game.metadata.name = id;
  game.clockSnapshot.startedAtUtc = new ClockTimestamp();
  game.renderedPath = game.livePath!;
  return game;
}
function _line() {
  const preview = createInitialBoardPosition();
  return [[12, 28], [52, 36], [6, 21]].map(([from, to]) => {
    const move = toDetailedMove(preview, { from: from!, to: to! });
    MoveApplicationService.applyMove(preview, move);
    return move;
  });
}
function _mountView(game: IGame = _createTimedGame()): VueWrapper {
  games.set(game.metadata.id, game);
  dependency.route.params.id = game.metadata.id;
  dependency.uiStateStore.gameSession = createGameSessionSnapshot({ openGameIds: [...games.keys()], activeGameId: game.metadata.id, activeRoute: `/game/${game.metadata.id}` });
  const wrapper = shallowMount(GameView, { global: { stubs: { ModalDialog: {
    name: 'ModalDialog', template: '<div><slot /><slot name="actions" /></div>',
  } } } });
  wrappers.push(wrapper);
  return wrapper;
}

describe('GameView menu interruptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    games = new Map();
    routeUpdates.splice(0);
    modal.open.mockReset().mockImplementation((_component: unknown, _props: unknown, onClosed?: () => Promise<void> | void) => {
      const controller = new AbortController();
      closeModal = async () => { controller.abort(); await onClosed?.(); };
      return { signal: controller.signal, close: closeModal };
    });
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
      makeMove: vi.fn(async () => {}),
      enterInGameAnalysis: vi.fn(async () => {}),
      exitInGameAnalysis: vi.fn(),
    });
    dependency.settingsStore = reactive({ settings: createSettingsSnapshot() });
    dependency.uiStateStore = reactive({
      gameSession: createGameSessionSnapshot(),
      layoutState: createUiLayoutState(),
    });
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });
  it('submits only owned raw fields from a board attempt', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'Chessboard' }).vm.$emit('moveAttempted', Object.freeze(toDetailedMove(game.rootPosition, { from: 12, to: 28 })));
    await flushPromises();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledExactlyOnceWith(game, { from: 12, to: 28 });
  });
  it('retains a copied raw PV prefix for playback, independently of its caller', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    const moves = _line();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', moves);
    await flushPromises();
    moves[1]!.to = 0;
    await vi.advanceTimersByTimeAsync(700);
    expect(dependency.gamesStore.makeMove.mock.calls.map((call) => call[1])).toEqual([
      { from: 12, to: 28 }, { from: 52, to: 36 }, { from: 6, to: 21 },
    ]);
  });
  it('preflights the whole raw PV before the first store call', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', [{ from: 12, to: 28 }, { from: 52, to: 20 }]);
    await flushPromises();
    expect(dependency.gamesStore.makeMove).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('stale');
  });
  it('copies raw historical continuation before confirmation', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    game.livePath = [0];
    game.renderedPath = [];
    game.gameState = GameState.LiveBlackTurn;
    game.gameplayOptions.allowTakeback = true;
    const wrapper = _mountView(game);
    await flushPromises();
    const move = { from: 11, to: 27 };
    wrapper.getComponent({ name: 'Chessboard' }).vm.$emit('moveAttempted', move);
    await flushPromises();
    move.to = 0;
    const props = modal.open.mock.lastCall![1] as ModalProps<typeof ConfirmationModal>;
    await props.confirm(new AbortController().signal);
    await flushPromises();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledExactlyOnceWith(game, { from: 11, to: 27 });
  });
  it.each([GameState.PausedBlackTurn, GameState.LiveAnalysisFromBlackTurnWhiteMove])('rejects a retained continuation after changing to %s', async (state) => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    game.livePath = [0];
    game.renderedPath = [];
    game.gameState = GameState.LiveBlackTurn;
    game.gameplayOptions.allowTakeback = true;
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'Chessboard' }).vm.$emit('moveAttempted', { from: 11, to: 27 });
    await flushPromises();
    const props = modal.open.mock.lastCall![1] as ModalProps<typeof ConfirmationModal>;
    game.gameState = state;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    await props.confirm(new AbortController().signal);
    expect(dependency.gamesStore.makeMove).not.toHaveBeenCalled();
  });
  it('requires explicit analysis for history exploration without inventing a control mode', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    game.livePath = [0];
    game.renderedPath = [];
    game.gameState = GameState.LiveBlackTurn;
    game.gameplayOptions.allowTakeback = false;
    const wrapper = _mountView(game);
    await flushPromises();
    expect(wrapper.getComponent({ name: 'GameControlPanel' }).props('mode')).toBe('live');
    expect(wrapper.getComponent({ name: 'Chessboard' }).props('inputDisabled')).toBe(true);
    expect(wrapper.getComponent({ name: 'AnalysisPanel' }).props('disabled')).toBe(true);
  });
  it('retains ordinary history move confirmation when Takeback is allowed', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    game.livePath = [0];
    game.renderedPath = [];
    game.gameState = GameState.LiveBlackTurn;
    game.gameplayOptions.allowTakeback = true;
    const wrapper = _mountView(game);
    await flushPromises();
    expect(wrapper.getComponent({ name: 'Chessboard' }).props('inputDisabled')).toBe(false);
    wrapper.getComponent({ name: 'Chessboard' }).vm.$emit('moveAttempted', toDetailedMove(game.rootPosition, { from: 11, to: 27 }));
    await flushPromises();
    expect(modal.open).toHaveBeenCalledWith(ConfirmationModal, expect.objectContaining({ title: 'Continue from this position?' }));
    expect(dependency.gamesStore.makeMove).not.toHaveBeenCalled();
  });
  it('exposes paused Analyse and Exit while retaining Resume and independent exploratory input', async () => {
    const game = _createTimedGame('game-1', [PauseReason.Manual]);
    game.gameState = GameState.PausedWhiteTurn;
    const wrapper = _mountView(game);
    await flushPromises();
    const action = wrapper.findAll('button').find((button) => button.text().includes('Analyse'));
    expect(action).toBeDefined();
    await action!.trigger('click');
    expect(dependency.gamesStore.enterInGameAnalysis).toHaveBeenCalledWith(game);
    game.gameState = GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(wrapper.getComponent({ name: 'GameControlPanel' }).props('mode')).toBe('paused');
    expect(wrapper.getComponent({ name: 'Chessboard' }).props('inputDisabled')).toBe(false);
    expect(wrapper.getComponent({ name: 'HistoryPanel' }).props('disabled')).toBe(false);
    expect(wrapper.getComponent({ name: 'AnalysisPanel' }).props('disabled')).toBe(false);
    expect(wrapper.getComponent({ name: 'GameControlPanel' }).props('canTakeBack')).toBe(false);
    const exit = wrapper.findAll('button').find((button) => button.text().includes('Exit analysis'));
    expect(exit).toBeDefined();
    await exit!.trigger('click');
    expect(dependency.gamesStore.exitInGameAnalysis).toHaveBeenCalledWith(game);
    expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalled();
  });
  it('applies explicit historical analysis directly without opening rewrite confirmation', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    MoveHistoryService.addMainlineMove(game.moveTree.root, toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    game.livePath = [0];
    game.renderedPath = [];
    game.gameState = GameState.LiveAnalysisFromBlackTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'Chessboard' }).vm.$emit('moveAttempted', toDetailedMove(game.rootPosition, { from: 11, to: 27 }));
    await flushPromises();
    expect(modal.open).not.toHaveBeenCalled();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
  });
  it('replaces the board input owner when entering analysis at the same canonical node', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    const wrapper = _mountView(game);
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const original = board.props('position');
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(board.props('position')).not.toBe(original);
    expect(wrapper.getComponent({ name: 'GameControlPanel' }).props('mode')).toBe('inGameAnalysis');
  });
  it('rejects a retained board callback after its selected input context changes', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    const wrapper = _mountView(game);
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const retained = board.vm.$.vnode.props!.onMoveAttempted as (move: ReturnType<typeof toDetailedMove>) => unknown;
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    await retained(toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    expect(dependency.gamesStore.makeMove).not.toHaveBeenCalled();
    board.vm.$emit('moveAttempted', toDetailedMove(game.rootPosition, { from: 12, to: 28 }));
    await flushPromises();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
  });
  it.each([false, true])('plays a complete analysis prefix with actual pause %s', async (paused) => {
    const game = _createTimedGame('game-1', paused ? [PauseReason.Manual] : []);
    game.rootPosition = createInitialBoardPosition();
    game.gameState = paused ? GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove : GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', _line());
    await flushPromises();
    await vi.advanceTimersByTimeAsync(700);
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledTimes(3);
    expect(game.$!.pauseReasons).toEqual(paused ? [PauseReason.Manual] : []);
    expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalled();
  });
  it('stops a delayed analysis prefix when background actual play ends', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', _line());
    await flushPromises();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
    game.resultState = ResultState.BlackWon;
    game.gameState = GameState.AnalysisWhiteMove;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    await vi.advanceTimersByTimeAsync(700);
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
  });
  it('preserves selected input when actual colour changes behind analysis', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    game.renderedPath = [];
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    const wrapper = _mountView(game);
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const selected = board.props('position');
    MoveHistoryService.addMainlineMove(game.moveTree.root, _line()[0]!);
    game.livePath!.push(0);
    game.gameState = GameState.LiveAnalysisFromBlackTurnWhiteMove;
    dependency.gamesStore.workspaceRevision += 1;
    await nextTick();
    expect(board.props('position')).toBe(selected);
    expect(board.props('inputDisabled')).toBe(false);
  });
  it('cancels delayed analysis playback before Exit changes the mode', async () => {
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;
    dependency.gamesStore.exitInGameAnalysis.mockImplementation(() => { game.gameState = GameState.LiveWhiteTurn; });
    const wrapper = _mountView(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', _line());
    await flushPromises();
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
    wrapper.getComponent({ name: 'GameControlPanel' }).vm.$emit('exitAnalysisRequested');
    await flushPromises();
    await vi.advanceTimersByTimeAsync(700);
    expect(dependency.gamesStore.makeMove).toHaveBeenCalledOnce();
    expect(dependency.gamesStore.exitInGameAnalysis).toHaveBeenCalledOnce();
  });
  it('publishes raw seat changes through workspaceRevision and allows paused runtime controls', async () => {
    const game = _createTimedGame();
    game.gameState = GameState.PausedWhiteTurn;
    const seat = createAnalysisSeat();
    game.analysis.seats = [seat];
    const wrapper = _mountView(game);
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
    const game = _createTimedGame();
    game.rootPosition = createInitialBoardPosition();
    const wrapper = _mountView(game);
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
    const wrapper = _mountView();
    await flushPromises();
    const board = wrapper.getComponent({ name: 'Chessboard' });
    const original = board.props('position');
    const other = _createTimedGame('game-2');
    games.set(other.metadata.id, other);
    await _selectRoute(other.metadata.id);
    expect(board.props('position')).toEqual(original);
    expect(board.props('position')).not.toBe(original);
  });

  it.each([
    ['homeRequested', '/home'],
    ['loadGameRequested', '/saved-games/load'],
    ['saveGameRequested', '/saved-games/save/game-1'],
    ['settingsRequested', '/settings/session'],
  ])('pauses before handling the %s route action', async (eventName, targetRoute) => {
    const game = _createTimedGame();
    const wrapper = _mountView(game);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit(eventName);
    await flushPromises();

    expect(dependency.gamesStore.pauseGame).toHaveBeenCalledWith(game, PauseReason.Menu);
    expect(dependency.router.push).toHaveBeenCalledWith(targetRoute);
    expect(dependency.gamesStore.pauseGame.mock.invocationCallOrder[0]).toBeLessThan(dependency.router.push.mock.invocationCallOrder[0]!);
  });
  it('does not pause route actions when auto-pause is disabled', async () => {
    dependency.settingsStore.settings.gameSession.autoPauseOnMenu = false;
    const wrapper = _mountView();
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('settingsRequested');
    await flushPromises();

    expect(dependency.gamesStore.pauseGame).not.toHaveBeenCalled();
    expect(dependency.router.push).toHaveBeenCalledWith('/settings/session');
  });
  it('resumes a returning menu-owned pause but preserves manual and analysis pause owners', async () => {
    const menuPausedGame = _createTimedGame('menu-paused', [PauseReason.Menu]);
    _mountView(menuPausedGame);
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(menuPausedGame, PauseReason.Menu);

    for (const reason of [PauseReason.Manual, PauseReason.Analysis]) {
      dependency.gamesStore.resumeGame.mockClear();
      _mountView(_createTimedGame(`${reason}-paused`, [reason]));
      await flushPromises();
      expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalled();
    }
  });
  it('resumes when custom-new is cancelled', async () => {
    const game = _createTimedGame();
    const wrapper = _mountView(game);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('customNewGameRequested');
    await flushPromises();
    expect(modal.open).toHaveBeenCalledWith(GameCreationModal, {}, expect.any(Function));
    expect(dependency.gamesStore.pauseGame).toHaveBeenCalledWith(game, PauseReason.Menu);

    await closeModal();
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(game, PauseReason.Menu);
  });
  it('keeps the interrupted game paused after custom-new creates another workspace', async () => {
    const interruptedGame = _createTimedGame('game-1');
    const newGame = _createTimedGame('game-2');
    games.set(newGame.metadata.id, newGame);
    const wrapper = _mountView(interruptedGame);
    await flushPromises();

    wrapper.getComponent({ name: 'MenuBar' }).vm.$emit('customNewGameRequested');
    await flushPromises();
    await _selectRoute(newGame.metadata.id);
    await closeModal();
    await flushPromises();
    expect(dependency.gamesStore.resumeGame).not.toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);

    await _selectRoute(interruptedGame.metadata.id);
    expect(dependency.gamesStore.resumeGame).toHaveBeenCalledWith(interruptedGame, PauseReason.Menu);
  });
});
