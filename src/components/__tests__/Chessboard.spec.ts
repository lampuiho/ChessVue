import { DOMWrapper, mount, type VueWrapper } from '@vue/test-utils';
import { markRaw } from 'vue';
import { afterEach, expect, it } from 'vitest';
import { BoardOrientation, PieceKind, PlayerColour } from '@/contracts';
import { createInitialBoardPosition, createSparseBoard } from '@/utility/chess';
import Chessboard from '@/components/Chessboard.vue';
import { modalPlugin } from '../modals/__tests__/ModalTestUtility';
const body = new DOMWrapper(document.body);
let wrapper: VueWrapper | undefined;
afterEach(() => wrapper?.unmount());
// Match GameView's raw derived board; rule queries update its non-reactive runtime caches.
const _initialPosition = () => markRaw(createInitialBoardPosition());
it.each(['position', 'mode'] as const)('discards an in-progress drag when the external %s changes', async (boundary) => {
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position: _initialPosition(), boardEdit: boundary === 'position' } });
  const source = wrapper.get('[aria-label="e2 white pawn"] .chess-piece');
  const target = wrapper.get('[aria-label="e4"]');
  await source.trigger('dragstart');
  await wrapper.setProps(boundary === 'position' ? { position: _initialPosition() } : { boardEdit: true });
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
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position } });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  expect(body.find('[role="dialog"][aria-label="Choose promotion"]').exists()).toBe(true);
  await wrapper.setProps({ position: _initialPosition() });
  expect(body.find('[role="dialog"][aria-label="Choose promotion"]').exists()).toBe(false);
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
});
it.each([BoardOrientation.White, BoardOrientation.Black].flatMap((orientation) =>
  [PlayerColour.White, PlayerColour.Black].flatMap((colour) => ['click', 'drag'].flatMap((gesture) =>
    [false, true].map((capture) => ({ orientation, colour, gesture, capture }))))))('emits raw $colour $gesture with capture $capture facing $orientation', async ({ orientation, colour, gesture, capture }) => {
  const white = colour === PlayerColour.White;
  const from = white ? 6 : 62;
  const to = white ? 21 : 45;
  const source = white ? 'g1 white knight' : 'g8 black knight';
  const target = white ? 'f3' : 'f6';
  const opponent = white ? PlayerColour.Black : PlayerColour.White;
  const position = markRaw(createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: from, piece: { colour, kind: PieceKind.Knight } },
    ...(capture ? [{ boardId: to, piece: { colour: opponent, kind: PieceKind.Pawn } }] : []),
  ], colour));
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position, orientation } });
  if (gesture === 'drag') {
    await wrapper.get(`[aria-label="${source}"] .chess-piece`).trigger('dragstart');
    await wrapper.get(`[aria-label="${target}${capture ? ` ${opponent} pawn` : ''}"]`).trigger('drop');
  } else {
    await wrapper.get(`[aria-label="${source}"]`).trigger('click');
    await wrapper.get(`[aria-label="${target}${capture ? ` ${opponent} pawn` : ''}"]`).trigger('click');
  }
  expect(wrapper.emitted('moveAttempted')).toEqual([[{ from, to }]]);
  expect(position.board[from]?.kind).toBe(PieceKind.Knight);
});
it.each([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight])('emits only completed raw promotion to %s', async (promotionPiece) => {
  const position = markRaw(createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: 48, piece: { colour: PlayerColour.White, kind: PieceKind.Pawn } },
  ]));
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position } });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
  await body.get(`[aria-label="Promote to white ${promotionPiece}"]`).trigger('click');
  expect(wrapper.emitted('moveAttempted')).toEqual([[{ from: 48, to: 56, promotionPiece }]]);
});
it('cancels unfinished selection and drag when input permission is revoked', async () => {
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position: _initialPosition() } });
  await wrapper.get('[aria-label="e2 white pawn"] .chess-piece').trigger('dragstart');
  await wrapper.setProps({ inputDisabled: true });
  await wrapper.get('[aria-label="e4"]').trigger('drop');
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
  await wrapper.setProps({ inputDisabled: false });
  await wrapper.get('[aria-label="e4"]').trigger('click');
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
});
it('preserves selection and drag through local rendering and presentation-only prop updates', async () => {
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position: _initialPosition() } });
  await wrapper.get('[aria-label="e2 white pawn"] .chess-piece').trigger('dragstart');
  await wrapper.setProps({ orientation: BoardOrientation.Black, showCoordinates: false, highlightLastMove: false });
  expect(wrapper.get('[aria-label="e2 white pawn"]').attributes('aria-pressed')).toBe('true');
  await wrapper.get('[aria-label="e4"]').trigger('drop');
  expect(wrapper.emitted('moveAttempted')).toEqual([[{ from: 12, to: 28 }]]);
});
it.each(['boardEdit', 'inputDisabled'] as const)('closes pending promotion when %s takes ownership of input', async (boundary) => {
  const position = markRaw(createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: 48, piece: { colour: PlayerColour.White, kind: PieceKind.Pawn } },
  ]));
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position } });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  const oldChoice = body.get('[aria-label="Promote to white queen"]');
  await wrapper.setProps({ [boundary]: true });
  expect(body.find('[role="dialog"][aria-label="Choose promotion"]').exists()).toBe(false);
  await wrapper.setProps({ [boundary]: false });
  await oldChoice.trigger('click');
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
});
it('rejects a detached promotion button after a new chooser owns the same squares', async () => {
  const initial = createSparseBoard([
    { boardId: 4, piece: { colour: PlayerColour.White, kind: PieceKind.King } },
    { boardId: 60, piece: { colour: PlayerColour.Black, kind: PieceKind.King } },
    { boardId: 48, piece: { colour: PlayerColour.White, kind: PieceKind.Pawn } },
  ]);
  wrapper = mount(Chessboard, { global: { plugins: [modalPlugin] }, props: { position: markRaw(initial) } });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  const detached = body.get('[aria-label="Promote to white queen"]');
  await wrapper.setProps({ position: markRaw(structuredClone(initial)) });
  await wrapper.get('[aria-label="a7 white pawn"]').trigger('click');
  await wrapper.get('[aria-label="a8"]').trigger('click');
  await detached.trigger('click');
  expect(wrapper.emitted('moveAttempted')).toBeUndefined();
  expect(body.find('[role="dialog"][aria-label="Choose promotion"]').exists()).toBe(true);
  await body.get('[aria-label="Promote to white knight"]').trigger('click');
  expect(wrapper.emitted('moveAttempted')).toEqual([[{ from: 48, to: 56, promotionPiece: PieceKind.Knight }]]);
});
