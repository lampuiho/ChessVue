import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppModalKind, PieceKind, PlayerColour, appModalStateSchema } from '@/contracts';
import { createGame } from '@/state/__tests__/StateStoreTestUtility';
import { createSparseBoard } from '@/utility/chess';
import ModalHost from '../ModalHost.vue';
const dependency = vi.hoisted(() => ({ ui: {} as Record<string, unknown>, games: { getGame: vi.fn(), makeMove: vi.fn() } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/state', () => ({
  useUiStateStore: () => dependency.ui, useGamesStore: () => dependency.games,
  useSettingsStore: () => ({}), useEnginesStore: () => ({}), useSavedGamesStore: () => ({}),
}));
let wrapper: VueWrapper;
beforeEach(() => {
  const game = createGame({ rootPosition: createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: 48, piece: { colour: PlayerColour.White, kind: PieceKind.Pawn } },
  ]) });
  dependency.games.getGame.mockReturnValue(game);
  dependency.games.makeMove.mockReset().mockResolvedValue(undefined);
  dependency.ui = reactive({ modalState: { kind: AppModalKind.Promotion, payload: { gameId: game.metadata.id, move: { from: 48, to: 56 } } },
    modalForm: { isWorking: false, errorMessage: '' }, getModalSignal: () => new AbortController().signal, hideModal: vi.fn() });
  wrapper = shallowMount(ModalHost, { global: { stubs: { ModalDialog: { name: 'ModalDialog', template: '<div><slot /><slot name="actions" /></div>' } } } });
});
afterEach(() => wrapper.unmount());
it('accepts a raw promotion modal payload without requiring transition details', () => {
  expect(appModalStateSchema.safeParse(dependency.ui.modalState).success).toBe(true);
});
it.each([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight])('submits raw promotion to %s through the existing action', async (promotionPiece) => {
  await wrapper.get(`[aria-label="Promote to ${promotionPiece}"]`).trigger('click');
  await flushPromises();
  expect(dependency.games.makeMove).toHaveBeenCalledExactlyOnceWith(dependency.games.getGame(), { from: 48, to: 56, promotionPiece });
});
it('cancels without submitting a move', async () => {
  await wrapper.findAll('button').find((button) => button.text() === 'Cancel')!.trigger('click');
  expect(dependency.games.makeMove).not.toHaveBeenCalled();
  expect(dependency.ui.hideModal).toHaveBeenCalledOnce();
});
