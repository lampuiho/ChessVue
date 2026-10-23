import { shallowMount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { PieceKind, PlayerColour, type IMoveRaw } from '@/contracts';
import PromotionModal from '../PromotionModal.vue';
const moves: readonly IMoveRaw[] = Object.freeze([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight].map((promotionPiece) => Object.freeze({ from: 48, to: 56, promotionPiece })));
function _mount(signal = new AbortController().signal) {
  return shallowMount(PromotionModal, { props: { moves, colour: PlayerColour.White, signal }, global: { stubs: {
    ModalDialog: { template: '<div><slot /><slot name="actions" /></div>' },
  } } });
}
it.each(moves)('returns the offered raw choice $promotionPiece without accessing game state', async (move) => {
  const wrapper = _mount();
  await wrapper.get(`[aria-label="Promote to white ${move.promotionPiece}"]`).trigger('click');
  expect(wrapper.emitted('selected')).toEqual([[move]]);
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
  wrapper.unmount();
});
it('cancels without selecting a move', async () => {
  const wrapper = _mount();
  await wrapper.findAll('button').find((button) => button.text() === 'Cancel')!.trigger('click');
  expect(wrapper.emitted('selected')).toBeUndefined();
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
  wrapper.unmount();
});
it('rejects a retained choice after its owner is aborted', async () => {
  const controller = new AbortController();
  const wrapper = _mount(controller.signal);
  controller.abort();
  await wrapper.get('[aria-label="Promote to white queen"]').trigger('click');
  expect(wrapper.emitted('selected')).toBeUndefined();
  wrapper.unmount();
});
