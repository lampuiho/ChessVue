import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ResultReason, ResultState, type IGame } from '@/contracts';
import { createGame } from '@/state/__tests__/StateStoreTestUtility';
import GameResultModal from '@/components/modals/GameResultModal.vue';

const dependency = vi.hoisted(() => ({})) as ReturnType<typeof _dependencies>;
vi.mock('@/state', () => ({ useGamesStore: () => dependency.games }));
vi.mock('vue-router', () => ({ useRouter: () => dependency.router }));
vi.mock('@/composables/GameTabActionsComposable', () => ({ useGameTabActions: () => dependency.tabActions }));
function _dependencies(game: IGame = createGame()) {
  return { game, router: { push: vi.fn(async () => {}) },
    tabActions: { close: vi.fn(async () => {}), select: vi.fn(async () => {}) },
    games: { getGame: vi.fn(() => game), refreshAnalysis: vi.fn(async () => {}) },
  };
}
function _mount(overrides: Partial<IGame> = {}) {
  Object.assign(dependency, _dependencies(createGame(overrides)));
  return mount(GameResultModal, { props: { gameId: 'game-1', signal: new AbortController().signal } });
}
function _button(label: string) {
  return wrapper.findAll('button').find((item) => item.text().includes(label))!;
}
beforeEach(() => vi.clearAllMocks());
let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());

it.each([
  [ResultState.WhiteWon, ResultReason.Checkmate, 'White wins by checkmate.'],
  [ResultState.BlackWon, ResultReason.Timeout, 'Black wins on time.'],
  [ResultState.WhiteWon, ResultReason.Resignation, 'White wins by resignation.'],
  [ResultState.Drawn, ResultReason.Stalemate, 'Draw by stalemate.'],
  [ResultState.Drawn, ResultReason.InsufficientMaterial, 'Draw by insufficient material.'],
  [ResultState.Drawn, ResultReason.DrawAgreement, 'Draw by agreement.'],
  [ResultState.Abandoned, ResultReason.Abandoned, 'Game abandoned.'],
  [ResultState.Drawn, undefined, 'Draw.'],
])('announces %s %s as "%s"', (resultState, resultReason, sentence) => {
  wrapper = _mount({ resultState, resultReason });
  expect(wrapper.get('.modal-copy--result').text()).toBe(sentence);
});
it('closes the game tab when exiting and dismisses first so no dialog outlives the route', async () => {
  wrapper = _mount({ resultState: ResultState.WhiteWon, resultReason: ResultReason.Checkmate });
  await _button('Exit').trigger('click');
  await flushPromises();
  expect(dependency.tabActions.close).toHaveBeenCalledWith('game-1');
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
});
it('routes to the save surface for the finished game', async () => {
  wrapper = _mount({ resultState: ResultState.Drawn, resultReason: ResultReason.Stalemate });
  await _button('Save for analysis').trigger('click');
  await flushPromises();
  expect(dependency.router.push).toHaveBeenCalledWith('/saved-games/save/game-1');
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
});
it('refreshes the engines and closes, leaving the final position on the board', async () => {
  wrapper = _mount({ resultState: ResultState.WhiteWon, resultReason: ResultReason.Checkmate });
  dependency.game.analysis.seats.push({} as never);
  await _button('Start analysis').trigger('click');
  await flushPromises();
  expect(dependency.games.refreshAnalysis).toHaveBeenCalledWith(dependency.game);
  expect(dependency.router.push).not.toHaveBeenCalled();
  expect(dependency.tabActions.close).not.toHaveBeenCalled();
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
});
it('surfaces a failed analysis refresh inline and keeps the dialog open', async () => {
  wrapper = _mount({ resultState: ResultState.WhiteWon, resultReason: ResultReason.Checkmate });
  dependency.game.analysis.seats.push({} as never);
  dependency.games.refreshAnalysis.mockRejectedValueOnce(new Error('Engine unavailable'));
  await _button('Start analysis').trigger('click');
  await flushPromises();
  expect(wrapper.text()).toContain('Engine unavailable');
  expect(wrapper.emitted('dismissed')).toBeUndefined();
});
it('offers no stray exit: the backdrop, Escape and the header close are all absent', async () => {
  wrapper = _mount({ resultState: ResultState.WhiteWon, resultReason: ResultReason.Checkmate });
  await wrapper.get('.modal-backdrop').trigger('mousedown');
  await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
  expect(wrapper.find('[aria-label="Close dialog"]').exists()).toBe(false);
  expect(wrapper.emitted('dismissed')).toBeUndefined();
});
