import { mount, type VueWrapper } from '@vue/test-utils';
import { markRaw } from 'vue';
import { afterEach, expect, it } from 'vitest';
import { PieceKind, PlayerColour } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard } from '@/utility/chess';
import Chessboard from '../Chessboard.vue';
let wrapper: VueWrapper | undefined;
afterEach(() => wrapper?.unmount());
// Match GameView's raw derived board; rule queries update its non-reactive runtime caches.
const initialPosition = () => markRaw(createInitialBoardPosition());
it.each(['position', 'mode'] as const)('discards an in-progress drag when the external %s changes', async (boundary) => {
  wrapper = mount(Chessboard, { props: { position: initialPosition(), boardEdit: boundary === 'position' } });
  const source = wrapper.get('[aria-label="e2 white pawn"] .chess-piece');
  const target = wrapper.get('[aria-label="e4"]');
  await source.trigger('dragstart');
  await wrapper.setProps(boundary === 'position' ? { position: initialPosition() } : { boardEdit: true });
  await target.trigger('drop');
  expect(wrapper.emitted('chessPieceMoved')).toBeUndefined();
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
  await source.trigger('dragstart');
  await target.trigger('drop');
  expect(wrapper.emitted('chessPieceMoved')).toEqual([[12, 28]]);
});
it('discards a pending promotion when an external position replaces its board', async () => {
  const position = markRaw(createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: 48, piece: { colour: PlayerColour.White, kind: PieceKind.Pawn } },
  ]));
  wrapper = mount(Chessboard, { props: { position } });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  expect(wrapper.find('[aria-label="Pawn promotion"]').exists()).toBe(true);
  await wrapper.setProps({ position: initialPosition() });
  expect(wrapper.find('[aria-label="Pawn promotion"]').exists()).toBe(false);
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
});
