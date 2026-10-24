import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineAvailability, GameState, PlayerColour, type IAnalysisSeat, type IGame, type IUiLayoutState } from '@/contracts';
import { createAnalysisSeat, createEngineRecord, createGame, createMove, createSettingsSnapshot, createUiLayoutState } from '@/state/__tests__/StateStoreTestUtility';
import AnalysisPanel from '@/components/AnalysisPanel.vue';
import { Deferred } from '@/utility/async/Deferred';

const dependency = vi.hoisted(() => ({})) as ReturnType<typeof _dependencies>;
const modal = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/state', () => ({ useGamesStore: () => dependency.games, useSettingsStore: () => dependency.settings, useUiStateStore: () => dependency.ui }));
vi.mock('@/composables/ModalComposable', () => ({ useModal: () => modal }));
const wrappers: VueWrapper[] = [];
function _dependencies() {
  const game = reactive(createGame());
  const layout = reactive(createUiLayoutState());
  return { game, settings: reactive({ settings: createSettingsSnapshot() }),
    games: { getGame: vi.fn(() => game), getVisibleAnalysis: vi.fn((current: IGame) => ({ engineSeats: current.analysis.seats })),
      refreshAnalysis: vi.fn(async () => {}), retryAnalysis: vi.fn(async () => {}), stopAnalysis: vi.fn(async () => {}), removeAnalysisEngine: vi.fn(async (_game: IGame, _index: number) => {}) },
    ui: { layoutState: layout, saveLayoutState: vi.fn(async () => {}),
      setSectionCollapsed: vi.fn(() => { layout.analysisCollapsed = !layout.analysisCollapsed; }),
      setAnalysisEngineExpanded: vi.fn((index: number) => { layout.analysisEngineExpandedByIndex[index] = layout.analysisEngineExpandedByIndex[index] === false; }),
      setLayoutState: vi.fn((value: IUiLayoutState) => { Object.assign(layout, value); }) },
  };
}
function _mount(seats: IAnalysisSeat[], options: { showMoves?: boolean; disabled?: boolean; collapsed?: boolean; expandedByIndex?: boolean[]; startDisabled?: boolean } = {}) {
  dependency.game.analysis.seats = seats;
  dependency.game.gameplayOptions.showLiveAnalysisMoves = options.showMoves ?? false;
  dependency.game.gameState = options.startDisabled ? GameState.BoardEdit : GameState.PausedWhiteTurn;
  dependency.ui.layoutState.analysisCollapsed = options.collapsed ?? false;
  dependency.ui.layoutState.analysisEngineExpandedByIndex = options.expandedByIndex ?? [];
  const wrapper = mount(AnalysisPanel, { props: { gameId: dependency.game.metadata.id, disabled: options.disabled } });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => { Object.assign(dependency, _dependencies()); vi.clearAllMocks(); });
afterEach(() => { for (const wrapper of wrappers.splice(0)) wrapper.unmount(); });
describe('AnalysisPanel seats', () => {
  it('selects only the suggested prefix ending at the clicked move', async () => {
    const seat = createAnalysisSeat();
    const moves = [createMove(PlayerColour.White), createMove(PlayerColour.Black)];
    for (const move of moves) Object.freeze(move);
    seat.lines = [{ depth: 12, pv: moves }];
    const wrapper = _mount([seat], { showMoves: true });
    const buttons = wrapper.findAll('.analysis-lines button');
    await buttons[0]!.trigger('click');
    await buttons[1]!.trigger('click');
    expect(wrapper.emitted('moveSelected')).toEqual([[[moves[0]]], [moves]]);
    const prefix = wrapper.emitted('moveSelected')![1]![0] as typeof moves;
    expect(prefix).not.toBe(moves);
    expect(prefix[0]).toBe(moves[0]);
    expect(prefix[1]).toBe(moves[1]);
    wrapper.unmount();
  });
  it('renders prepared lines and keeps restored empty assignments manageable', () => {
    const populated = createAnalysisSeat();
    const empty = createAnalysisSeat(createEngineRecord('second', 'Second engine'));
    populated.lines = [{ depth: 12, scoreCp: 30, pv: [createMove(PlayerColour.White)] }];
    populated.assignedEngine.$ = { availability: EngineAvailability.Running, analysisLines: new Map([[4, { depth: 99, pv: [] }]]) };
    const wrapper = _mount([populated, empty], { showMoves: true });
    expect(wrapper.findAll('.engine-section')).toHaveLength(2);
    expect(wrapper.findAll('.analysis-lines button')).toHaveLength(1);
    expect(wrapper.text()).toContain('d12');
    expect(wrapper.text()).not.toContain('d99');
    expect(wrapper.text()).toContain('Engine unavailable');
    expect(wrapper.text()).not.toContain('No engine assigned');
    expect(wrapper.get<HTMLButtonElement>('[title="Refresh analysis"]').element.disabled).toBe(false);
    wrapper.unmount();
  });
  it('blocks paused move selection while allowing refresh, retry, stop, and removal', async () => {
    const running = createAnalysisSeat();
    const failed = createAnalysisSeat(createEngineRecord('second', 'Second engine'));
    running.lines = [{ depth: 12, pv: [createMove(PlayerColour.White)] }];
    running.assignedEngine.$ = { availability: EngineAvailability.Running, analysisLines: new Map() };
    failed.assignedEngine.$ = { availability: EngineAvailability.Failed, lastError: 'Engine failed', analysisLines: new Map() };
    const wrapper = _mount([running, failed], { showMoves: true, disabled: true });
    expect(wrapper.get<HTMLButtonElement>('.analysis-lines button').element.disabled).toBe(true);
    for (const title of ['Refresh analysis', 'Retry engine', 'Stop engine', 'Remove engine']) {
      const button = wrapper.find<HTMLButtonElement>(`[title="${title}"]`);
      expect(button.element.disabled).toBe(false);
      await button.trigger('click');
    }
    expect(dependency.games.refreshAnalysis).toHaveBeenCalledWith(dependency.game);
    expect(dependency.games.retryAnalysis).toHaveBeenCalledWith(dependency.game, 1);
    expect(dependency.games.stopAnalysis).toHaveBeenCalledWith(dependency.game, 0);
    expect(dependency.games.removeAnalysisEngine).toHaveBeenCalledWith(dependency.game, 0);
    dependency.game.gameState = GameState.BoardEdit;
    await nextTick();
    expect(wrapper.get<HTMLButtonElement>('[title="Refresh analysis"]').element.disabled).toBe(true);
    expect(wrapper.get<HTMLButtonElement>('[title="Retry engine"]').element.disabled).toBe(true);
    wrapper.unmount();
  });
  it('allows stopping an empty seat while its engine is still starting', async () => {
    const seat = createAnalysisSeat();
    seat.assignedEngine.$ = { availability: EngineAvailability.Starting, analysisLines: new Map() };
    const wrapper = _mount([seat], { disabled: true });
    expect(wrapper.get('.engine-section__name').attributes('title')).toBe('Waiting for engine');
    await wrapper.get('[title="Stop engine"]').trigger('click');
    expect(dependency.games.stopAnalysis).toHaveBeenCalledWith(dependency.game, 0);
    wrapper.unmount();
  });
  it('retains accepted lines alongside failure feedback without claiming completion after Stop', async () => {
    const seat = createAnalysisSeat();
    seat.lines = [{ depth: 12, pv: [createMove(PlayerColour.White)] }];
    seat.assignedEngine.$ = { availability: EngineAvailability.Failed, lastError: 'Disconnected', analysisLines: new Map() };
    const wrapper = _mount([seat], { showMoves: true });
    expect(wrapper.text()).toContain('Disconnected');
    expect(wrapper.findAll('.analysis-lines button')).toHaveLength(1);
    seat.assignedEngine.$.availability = EngineAvailability.Ready;
    seat.assignedEngine.$.lastError = undefined;
    dependency.game.gameplayOptions.showLiveAnalysisMoves = false;
    await nextTick();
    expect(wrapper.get('.engine-section__name').attributes('title')).toBe('Analysis stopped');
    expect(wrapper.text()).not.toContain('Analysis complete');
    wrapper.unmount();
  });
  it('shows compact evaluations without folds, status text or move lists despite saved collapse state', async () => {
    const seats = [createAnalysisSeat(), createAnalysisSeat(createEngineRecord('second', 'Second engine'))];
    seats[0]!.lines = [{ depth: 32, scoreCp: 24, pv: [createMove(PlayerColour.White)] }];
    seats[1]!.lines = [{ depth: 12, scoreMate: -3, pv: [createMove(PlayerColour.Black)] }];
    const wrapper = _mount(seats, { showMoves: false, collapsed: true, expandedByIndex: [false, false] });
    expect(wrapper.get('h2').text()).toBe('Evaluations');
    expect(wrapper.findAll('.engine-section__name').map((name) => name.text())).toEqual(seats.map((seat) => seat.assignedEngine.displayName));
    expect(wrapper.findAll('.engine-section__score').map((score) => score.text())).toEqual(['+0.24', '−M3']);
    expect(wrapper.findAll('.side-panel__collapse, .engine-section__fold, .engine-summary, .analysis-lines')).toHaveLength(0);
    dependency.game.gameplayOptions.showLiveAnalysisMoves = true;
    dependency.ui.layoutState.analysisCollapsed = false;
    dependency.ui.layoutState.analysisEngineExpandedByIndex = [true, true];
    await nextTick();
    expect(wrapper.get('h2').text()).toBe('Analysis');
    expect(wrapper.findAll('.engine-section__fold')).toHaveLength(2);
    expect(wrapper.findAll('.analysis-line')).toHaveLength(2);
    wrapper.unmount();
  });
  it('shows each of three analysis continuations with its own score and depth', () => {
    const seat = createAnalysisSeat();
    seat.lines = [
      { depth: 32, scoreCp: 24, pv: [createMove(PlayerColour.White)] },
      { depth: 30, scoreCp: -18, pv: [createMove(PlayerColour.Black)] },
      { depth: 29, scoreMate: 3, pv: [createMove(PlayerColour.White)] },
    ];
    const wrapper = _mount([seat], { showMoves: true });
    expect(wrapper.findAll('.analysis-line__score').map((score) => score.text())).toEqual(['+0.24', '−0.18', 'M3']);
    expect(wrapper.findAll('.analysis-line small').map((depth) => depth.text())).toEqual(['d32', 'd30', 'd29']);
    wrapper.unmount();
  });
});
it('saves a collapsed section locally and keeps a rejected save visible', async () => {
  const wrapper = _mount([createAnalysisSeat()], { showMoves: true });
  dependency.ui.saveLayoutState.mockRejectedValueOnce(new Error('Layout disk full'));
  await wrapper.get('[aria-label="Collapse analysis"]').trigger('click');
  await flushPromises();
  expect(dependency.ui.layoutState.analysisCollapsed).toBe(true);
  expect(wrapper.find('.analysis-list').exists()).toBe(false);
  expect(wrapper.get('[role="alert"]').text()).toContain('Layout disk full');
});
it('reconciles the removed seat fold before its owned engine cleanup settles', async () => {
  const wrapper = _mount([createAnalysisSeat(), createAnalysisSeat(createEngineRecord('other', 'Other'))], { showMoves: true, expandedByIndex: [false, true] });
  const surviving = dependency.game.analysis.seats[1];
  const cleanup = new Deferred<void>();
  dependency.games.removeAnalysisEngine.mockImplementationOnce(async (game, index) => {
    game.analysis.seats.splice(index, 1);
    await cleanup;
  });
  await wrapper.findAll('[title="Remove engine"]')[0]!.trigger('click');
  expect(dependency.game.analysis.seats).toEqual([surviving]);
  expect(dependency.ui.layoutState.analysisEngineExpandedByIndex).toEqual([true]);
  expect(dependency.ui.saveLayoutState).toHaveBeenCalledOnce();
  cleanup.resolve();
  await flushPromises();
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
});
