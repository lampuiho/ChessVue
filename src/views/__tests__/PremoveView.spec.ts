import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardOrientation, GameState, PieceKind, PlayerColour, PlayerType, ResultState, type IGame, type IMove, type IPremove } from '@/contracts';
import { MoveApplicationService, MoveHistoryService } from '@/domain';
import { buildFen, genLegalMoves, getUci } from '@/utility/chess';
import { createGame, createGameSessionSnapshot, createSettingsSnapshot, createUiLayoutState } from '@/state/__tests__/StateStoreTestUtility';
import { castlePosition, fixturePlayer, fixturePosition, localSeat, pieceMap, premove, promotionPosition, squareId, whiteChain, type IPositionFixture } from '@/state/__tests__/PremoveFixture';
import { premoveProjectionScenarios } from '@/state/__tests__/PremoveProjectionScenario';
import GameView from '../GameView.vue';
import Chessboard from '@/components/Chessboard.vue';
import ChessPiece from '@/components/common/ChessPiece.vue';

interface IViewDependency {
  route: { params: { id: string } };
  router: { push: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
  store: ReturnType<typeof _store>;
  settings: { settings: ReturnType<typeof createSettingsSnapshot> };
  ui: ReturnType<typeof _ui>;
}
const dependency = vi.hoisted(() => ({})) as IViewDependency;
vi.mock('vue-router', () => ({
  useRoute: () => dependency.route, useRouter: () => dependency.router,
  onBeforeRouteUpdate: (handler: (to: { params: { id: string } }) => unknown) => routeUpdates.push(handler), onBeforeRouteLeave: vi.fn(),
}));
vi.mock('@/state', () => ({ useGamesStore: () => dependency.store, useSettingsStore: () => dependency.settings, useUiStateStore: () => dependency.ui }));
const routeUpdates: Array<(to: { params: { id: string } }) => unknown> = [];
const games = new Map<string, IGame>();
const wrappers: VueWrapper[] = [];
function _store() {
  return { workspaceRevision: 0, getGame: vi.fn((id: string) => games.get(id)), listGames: vi.fn(() => [...games.values()]),
    getVisibleAnalysis: vi.fn((game: IGame) => ({ engineSeats: game.analysis.seats })), getTakeBackMoveCount: vi.fn(() => 1),
    onAutosaveFailed: vi.fn(() => () => {}), makeMove: vi.fn(async (_game: IGame, _move: IMove | IPremove) => {}),
    enterInGameAnalysis: vi.fn(async () => {}), exitInGameAnalysis: vi.fn(), navigateToNode: vi.fn(), takeBack: vi.fn(),
    pauseGame: vi.fn(async () => {}), resumeGame: vi.fn(async () => {}), undoPremove: vi.fn(async () => {}),
    clearPremoves: vi.fn(async (game: IGame) => { game.$!.premoveQueue = undefined; }),
  };
}
function _ui() {
  return { gameSession: createGameSessionSnapshot(), layoutState: createUiLayoutState(),
    showModal: vi.fn(), setActiveGame: vi.fn(), closeTab: vi.fn((id: string) => {
      dependency.ui.gameSession.openGameIds = dependency.ui.gameSession.openGameIds.filter((item) => item !== id);
      dependency.ui.gameSession.activeGameId = dependency.ui.gameSession.openGameIds[0];
    }) };
}
interface IViewFixture { root?: IPositionFixture; played?: readonly string[]; queue?: readonly IPremove[]; hotseat?: boolean; id?: string; side?: PlayerColour; local?: PlayerColour; }
function _game(fixture: IViewFixture = {}) {
  const rootPosition = fixturePosition(fixture.root);
  if (fixture.side) rootPosition.sideToMove = fixture.side;
  const local = fixture.local ?? PlayerColour.White;
  const game = createGame({ rootPosition, whitePlayer: fixturePlayer(PlayerColour.White, fixture.hotseat || local === PlayerColour.White ? PlayerType.Local : PlayerType.Engine),
    blackPlayer: fixturePlayer(PlayerColour.Black, fixture.hotseat || local === PlayerColour.Black ? PlayerType.Local : PlayerType.Engine),
    gameplayOptions: { allowTakeback: true, showLiveAnalysisMoves: true }, $: {} });
  const board = MoveApplicationService.genPosition(game.rootPosition, []);
  let node = game.moveTree.root;
  for (const uci of fixture.played ?? (fixture.root ? [] : ['e2e4'])) {
    const move = _legal(board, uci);
    node = MoveHistoryService.addMainlineMove(node, move);
    game.livePath!.push(node.$!.parent!.children.indexOf(node));
    MoveApplicationService.applyMove(board, move);
  }
  game.renderedPath = game.livePath!;
  game.gameState = board.sideToMove === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn;
  game.metadata.id = fixture.id ?? 'premove-view';
  const queue = fixture.queue ?? whiteChain;
  if (queue.length) game.$!.premoveQueue = { player: localSeat(game, local), moves: structuredClone([...queue]) };
  return game;
}
function _legal(board: IGame['rootPosition'], uci: string) {
  const move = genLegalMoves(board).find((item) => getUci(item) === uci);
  expect(move, `Legal view fixture ${uci}`).toBeDefined();
  return move!;
}
function _position(game: IGame) {
  return MoveApplicationService.genPosition(game.rootPosition, MoveHistoryService.getMoveSequence(game.moveTree, game.renderedPath));
}
function _mount(game: IGame = _game()) {
  games.set(game.metadata.id, game);
  dependency.route.params.id = game.metadata.id;
  dependency.ui.gameSession = createGameSessionSnapshot({ openGameIds: [...games.keys()], activeGameId: game.metadata.id });
  const wrapper = mount(GameView, { global: { stubs: { MenuBar: true, GameTabs: true, PlayerPanel: true, HistoryPanel: true, AnalysisPanel: true } } });
  wrappers.push(wrapper);
  return wrapper;
}
function _square(wrapper: VueWrapper, square: string) {
  return wrapper.get(`.board-square[aria-label^="${square}"]`);
}
function _redSquares(wrapper: VueWrapper) {
  return wrapper.findAll('.board-square--premove').map((square) => square.attributes('aria-label')!.split(' ')[0]).sort();
}
function _displayedPieces(wrapper: VueWrapper) {
  return Object.fromEntries(wrapper.findAll('.board-square').flatMap((square) => {
    const label = square.attributes('aria-label')!.split(' ')[0];
    const piece = square.findComponent(ChessPiece);
    if (!piece.exists()) { expect(square.attributes('aria-label')).toBe(label); return []; }
    const { colour, kind } = piece.props();
    expect(square.attributes('aria-label')).toBe(`${label} ${colour} ${kind}`);
    return [[label, `${colour} ${kind}`]];
  }));
}
async function _click(wrapper: VueWrapper, from: string, to: string) {
  await _square(wrapper, from).trigger('click');
  await _square(wrapper, to).trigger('click');
  await flushPromises();
}
function _preview(game: IGame, moves: string[]) {
  const position = _position(game);
  return moves.map((uci) => {
    const move = _legal(position, uci);
    MoveApplicationService.applyMove(position, move);
    return move;
  });
}
async function _publish() {
  dependency.store.workspaceRevision += 1;
  await nextTick();
}
async function _switch(id: string) {
  for (const hook of routeUpdates) await hook({ params: { id } });
  dependency.route.params.id = id;
  await flushPromises();
}
describe('premove scenarios at the mounted input boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    games.clear();
    routeUpdates.splice(0);
    dependency.route = reactive({ params: { id: 'premove-view' } });
    dependency.router = { push: vi.fn(async () => {}), replace: vi.fn(async () => {}) };
    dependency.store = reactive(_store());
    dependency.settings = reactive({ settings: createSettingsSnapshot() });
    dependency.ui = reactive(_ui());
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });
  it.each(premoveProjectionScenarios)('$name', async (spec) => {
    const game = _game({ root: spec.root, played: spec.played ?? [], queue: spec.moves, local: spec.colour });
    const canonical = _position(game);
    const before = buildFen(canonical);
    const queue = game.$!.premoveQueue;
    for (const move of queue?.moves ?? []) Object.freeze(move);
    if (queue) Object.freeze(queue.moves);
    const expected = pieceMap(canonical.board);
    if (!spec.invalid) {
      for (const [square, piece] of Object.entries(spec.cells!)) {
        if (piece === undefined) delete expected[square];
        else expected[square] = piece;
      }
    }
    const wrapper = _mount(game);
    await flushPromises();
    expect(_displayedPieces(wrapper)).toEqual(expected);
    expect(_redSquares(wrapper)).toEqual([...(spec.red ?? [])].sort());
    const board = wrapper.getComponent(Chessboard).props('position');
    expect(buildFen(board)).toBe(before);
    expect(pieceMap(board.board)).toEqual(pieceMap(canonical.board));
    expect(game.$!.premoveQueue).toBe(queue);
    expect(queue?.moves ?? []).toEqual(spec.moves);
  });
  it.each([BoardOrientation.White, BoardOrientation.Black])('PRE-S01 PRE-S03 draws the full displaced chain and red union with orientation %s', async (orientation) => {
    dependency.settings.settings.appearance.boardOrientation = orientation;
    const game = _game();
    const canonical = buildFen(_position(game));
    const wrapper = _mount(game);
    await flushPromises();
    expect(_square(wrapper, 'g5').attributes('aria-label')).toBe('g5 white knight');
    expect(_square(wrapper, 'g1').attributes('aria-label')).toBe('g1');
    expect(_square(wrapper, 'f3').attributes('aria-label')).toBe('f3');
    expect(_redSquares(wrapper)).toEqual(['f3', 'g1', 'g5']);
    expect(buildFen(wrapper.getComponent(Chessboard).props('position'))).toBe(canonical);
    expect(wrapper.getComponent(Chessboard).props('position').board[squareId('g1')]).toEqual({ colour: PlayerColour.White, kind: PieceKind.Knight });
  });
  it('PRE-S01 extends the chain from its displayed destination using raw local intent', async () => {
    const game = _game();
    const wrapper = _mount(game);
    await flushPromises();
    await _click(wrapper, 'g5', 'h7');
    expect(dependency.store.makeMove).toHaveBeenCalledExactlyOnceWith(game, premove('g5h7'));
  });
  it.each(['click', 'drag', 'keyboard activation'] as const)('PRE-S17 permits eligible own-piece off-turn %s input', async (gesture) => {
    const game = _game({ queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    expect(wrapper.getComponent(Chessboard).props('inputDisabled')).toBe(false);
    if (gesture === 'drag') {
      await _square(wrapper, 'g1').get('.chess-piece').trigger('dragstart');
      await _square(wrapper, 'f3').trigger('drop');
    } else {
      if (gesture === 'keyboard activation') await _square(wrapper, 'g1').trigger('keydown', { key: 'Enter' });
      await _click(wrapper, 'g1', 'f3'); // Native button activation and pointer input share click.
    }
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledExactlyOnceWith(game, whiteChain[0]);
  });
  it('PRE-S03 exposes explicit Undo last and Clear controls without invoking actual Takeback', async () => {
    const game = _game();
    const wrapper = _mount(game);
    await flushPromises();
    const buttons = wrapper.findAll('button');
    const undo = buttons.find((button) => /undo last/i.test(`${button.text()} ${button.attributes('aria-label') ?? ''}`));
    const clear = buttons.find((button) => /clear premoves/i.test(`${button.text()} ${button.attributes('aria-label') ?? ''}`));
    expect(undo, 'Undo last premove control').toBeDefined();
    expect(clear, 'Clear premoves control').toBeDefined();
    await undo!.trigger('click');
    await clear!.trigger('click');
    expect(dependency.store.undoPremove).toHaveBeenCalledWith(game);
    expect(dependency.store.clearPremoves).toHaveBeenCalledWith(game);
    expect(dependency.store.takeBack).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'castle', root: castlePosition, moves: [premove('e1g1', PieceKind.King)], cells: { g1: 'g1 white king', f1: 'f1 white rook', e1: 'e1', h1: 'h1' }, red: ['e1', 'f1', 'g1', 'h1'] },
    { name: 'underpromotion', root: promotionPosition, moves: [premove('a7a8n', PieceKind.Pawn)], cells: { a7: 'a7', a8: 'a8 white knight' }, red: ['a7', 'a8'] },
  ])('PRE-S04 draws $name from queue data without altering canonical pieces', async (spec) => {
    const game = _game({ root: spec.root, queue: spec.moves });
    const canonical = buildFen(_position(game));
    const wrapper = _mount(game);
    await flushPromises();
    for (const [square, label] of Object.entries(spec.cells)) expect(_square(wrapper, square).attributes('aria-label')).toBe(label);
    expect(_redSquares(wrapper)).toEqual(spec.red);
    expect(buildFen(wrapper.getComponent(Chessboard).props('position'))).toBe(canonical);
  });
  it('PRE-S05 hides projection in explicit analysis while retaining the queue', async () => {
    const game = _game();
    game.gameState = GameState.LiveAnalysisFromBlackTurnBlackMove;
    game.renderedPath = [...game.renderedPath];
    const queue = game.$!.premoveQueue;
    const wrapper = _mount(game);
    await flushPromises();
    expect(_square(wrapper, 'g1').attributes('aria-label')).toBe('g1 white knight');
    expect(_redSquares(wrapper)).toEqual([]);
    expect(game.$!.premoveQueue).toBe(queue);
  });
  it('PRE-S15 converts only the clicked local PV move into an off-turn intention', async () => {
    const game = _game({ queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    const pv = _preview(game, ['e7e5', 'g1f3']);
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', pv);
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledExactlyOnceWith(game, whiteChain[0]);
  });
  it('PRE-S15 refuses an engine-colour live PV rather than claiming the engine turn', async () => {
    const game = _game({ queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', _preview(game, ['e7e5']));
    await flushPromises();
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
  });
  it('PRE-S15 ordinary local PV input still commits only the first actual move', async () => {
    const game = _game({ played: [], queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    const line = _preview(game, ['e2e4', 'e7e5', 'g1f3']);
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', line);
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledExactlyOnceWith(game, line[0]);
  });
  it('PRE-S15 PRE-S18 explicit analysis plays its full prefix but Exit cancels its delayed suffix', async () => {
    const game = _game();
    game.gameState = GameState.LiveAnalysisFromBlackTurnBlackMove;
    game.renderedPath = [...game.renderedPath];
    const queue = game.$!.premoveQueue;
    const wrapper = _mount(game);
    await flushPromises();
    wrapper.getComponent({ name: 'AnalysisPanel' }).vm.$emit('moveSelected', _preview(game, ['e7e5', 'g1f3', 'b8c6']));
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledOnce();
    wrapper.getComponent({ name: 'GameControlPanel' }).vm.$emit('exitAnalysisRequested');
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    expect(dependency.store.makeMove).toHaveBeenCalledOnce();
    expect(dependency.store.exitInGameAnalysis).toHaveBeenCalledOnce();
    expect(game.$!.premoveQueue).toBe(queue);
  });
  it.each([PlayerColour.White, PlayerColour.Black])('PRE-S17 rejects %s callbacks after hotseat handoff and accepts fresh due-side input', async (first) => {
    const game = _game({ played: [], queue: [], hotseat: true, side: first });
    const wrapper = _mount(game);
    await flushPromises();
    const board = wrapper.getComponent(Chessboard);
    const retainedMove = board.vm.$.vnode.props!.onMoveAttempted as (move: IMove) => unknown;
    const retainedAnalyse = wrapper.getComponent({ name: 'GameControlPanel' }).vm.$.vnode.props!.onAnalysisRequested as () => unknown;
    const move = _legal(_position(game), first === PlayerColour.White ? 'e2e4' : 'e7e5');
    MoveHistoryService.addMainlineMove(game.moveTree.root, move);
    game.livePath!.push(0);
    game.gameState = first === PlayerColour.White ? GameState.LiveBlackTurn : GameState.LiveWhiteTurn;
    await _publish();
    await retainedMove(move);
    await retainedAnalyse();
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    expect(dependency.store.enterInGameAnalysis).not.toHaveBeenCalled();
    await _click(wrapper, first === PlayerColour.White ? 'e7' : 'e2', first === PlayerColour.White ? 'e5' : 'e4');
    expect(dependency.store.makeMove).toHaveBeenCalledOnce();
    expect(game.$!.premoveQueue).toBeUndefined();
  });
  it('PRE-S18 queue edits invalidate an old drag even though canonical FEN is unchanged', async () => {
    const game = _game({ queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    const board = wrapper.getComponent(Chessboard);
    const canonical = board.props('position');
    expect(board.props('inputDisabled')).toBe(false);
    await _square(wrapper, 'g1').get('.chess-piece').trigger('dragstart');
    game.$!.premoveQueue = { player: game.whitePlayer!, moves: [whiteChain[0]!] };
    await _publish();
    expect(buildFen(board.props('position'))).toBe(buildFen(canonical));
    await _square(wrapper, 'f3').trigger('drop');
    await flushPromises();
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    await _click(wrapper, 'f3', 'g5');
    expect(dependency.store.makeMove).toHaveBeenCalledExactlyOnceWith(game, whiteChain[1]);
  });
  it('PRE-S18 incomplete promotion is never queued and a real reply cancels its old chooser', async () => {
    const game = _game({ root: promotionPosition, queue: [] });
    const wrapper = _mount(game);
    await flushPromises();
    await _click(wrapper, 'a7', 'a8');
    const chooser = wrapper.find('[aria-label="Pawn promotion"]');
    expect(chooser.exists()).toBe(true);
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    const retainedChoice = chooser.get('[aria-label="Promote to white knight"]');
    const move = _legal(_position(game), 'h7h6');
    MoveHistoryService.addMainlineMove(game.moveTree.root, move);
    game.livePath!.push(0);
    game.gameState = GameState.LiveWhiteTurn;
    await _publish();
    expect(wrapper.find('[aria-label="Pawn promotion"]').exists()).toBe(false);
    await retainedChoice.trigger('click');
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    await _click(wrapper, 'a7', 'a8');
    await wrapper.get('[aria-label="Promote to white knight"]').trigger('click');
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledOnce();
    expect(dependency.store.makeMove.mock.calls[0]![1]).toMatchObject({ promotionPiece: PieceKind.Knight });
  });
  it('PRE-S19 temporary tab selection retains queues but explicit close cancels only that game', async () => {
    const first = _game({ id: 'first' });
    const second = _game({ id: 'second' });
    games.set(second.metadata.id, second);
    const wrapper = _mount(first);
    await flushPromises();
    const firstQueue = first.$!.premoveQueue;
    const secondQueue = second.$!.premoveQueue;
    await _switch('second');
    await _switch('first');
    expect(first.$!.premoveQueue).toBe(firstQueue);
    expect(second.$!.premoveQueue).toBe(secondQueue);
    wrapper.getComponent({ name: 'GameTabs' }).vm.$emit('tabClosed', 'first');
    await flushPromises();
    expect(dependency.store.clearPremoves).toHaveBeenCalledWith(first);
    expect(first.$!.premoveQueue).toBeUndefined();
    expect(second.$!.premoveQueue).toBe(secondQueue);
  });
  it('PRE-S13 cancelled and obsolete historical rewrite confirmation preserves the queue', async () => {
    const game = _game();
    game.renderedPath = [];
    const queue = game.$!.premoveQueue;
    const wrapper = _mount(game);
    await flushPromises();
    await _click(wrapper, 'd2', 'd4');
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'Cancel')!;
    expect(cancel).toBeDefined();
    await cancel.trigger('click');
    expect(game.$!.premoveQueue).toBe(queue);
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    await _click(wrapper, 'd2', 'd4');
    const retainedConfirm = wrapper.findAll('button').find((button) => button.text() === 'Continue game')!;
    wrapper.getComponent({ name: 'GameControlPanel' }).vm.$emit('analysisRequested');
    await flushPromises();
    await retainedConfirm.trigger('click');
    await flushPromises();
    expect(dependency.store.makeMove).not.toHaveBeenCalled();
    expect(game.$!.premoveQueue).toBe(queue);
  });
  it('PRE-S22 evaluation publications preserve selected input and canonical engine position', async () => {
    const game = _game();
    game.gameState = GameState.LiveAnalysisFromBlackTurnBlackMove;
    game.renderedPath = [...game.renderedPath];
    const wrapper = _mount(game);
    await flushPromises();
    const board = wrapper.getComponent(Chessboard);
    const canonical = board.props('position');
    const before = buildFen(canonical);
    await _square(wrapper, 'b8').trigger('click');
    expect(_square(wrapper, 'b8').attributes('aria-pressed')).toBe('true');
    await _publish();
    expect(board.props('position')).toBe(canonical);
    expect(buildFen(board.props('position'))).toBe(before);
    expect(_square(wrapper, 'b8').attributes('aria-pressed')).toBe('true');
    await _square(wrapper, 'c6').trigger('click');
    await flushPromises();
    expect(dependency.store.makeMove).toHaveBeenCalledOnce();
    expect(game.$!.premoveQueue!.moves).toEqual(whiteChain);
    expect(game.resultState).toBe(ResultState.Ongoing);
  });
});
