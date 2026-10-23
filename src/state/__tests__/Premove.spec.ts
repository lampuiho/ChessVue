import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, PauseReason, PieceKind, PlayerColour, PlayerType, TimeControlPreset, type IAssignedEngine, type IGame, type IMove, type IMoveNode, type IMoveRaw, type IPremoveQueue } from '@/contracts';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService, SerializationService, TimeControlService } from '@/domain';
import { buildFen, genLegalMoves, getUci } from '@/utility/chess';
import { ClockTimestamp } from '@/utility/date';
import { Deferred } from '@/utility/async/Deferred';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createEngineRecord, createGame, createSettingsSnapshot } from './StateStoreTestUtility';
import { fixturePlayer, fixturePosition, localSeat, pieceMap, premove, promotionPosition, whiteChain } from './PremoveFixture';
import { premoveScenarios, type IPremoveEvent, type IPremoveExpected, type IPremoveScenario } from './PremoveScenario';

interface IProviderTurn { game: IGame; position: IGame['rootPosition']; deliver: (move: IMove) => Promise<void>; signal?: AbortSignal; delivered?: boolean; }
const external = vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
  return { turns: [] as IProviderTurn[], settings: undefined as ReturnType<typeof createSettingsSnapshot> | undefined };
});
vi.mock('@/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain')>();
  return { ...actual,
    EngineRuntimeService: { ...actual.EngineRuntimeService, ensureReady: vi.fn(async () => {}), stopEngine: vi.fn(async () => {}),
      startPlayerTurn: vi.fn(async (_engine: IAssignedEngine, game: IGame, deliver: IProviderTurn['deliver'], signal?: AbortSignal) => {
        external.turns.push({ game, deliver, signal, position: actual.MoveApplicationService.genPosition(game.$!.livePosition!, []) });
      }),
      startAnalysis: vi.fn(async () => {}), subscribeToAnalysis: vi.fn(() => () => {}), stopAnalysis: vi.fn(async () => {}),
    },
    PlatformEventService: { ...actual.PlatformEventService, subscribeToAppFocusReturned: vi.fn(() => () => {}) },
    UserSettingService: { ...actual.UserSettingService, getSettings: () => external.settings!, getSettingsOrDefault: async () => external.settings! },
  };
});
interface IQueueAction { (game: IGame): Promise<void> | void; }
interface ISnapshot {
  canonical: string;
  clock: string;
  queue: IPremoveQueue | undefined;
  rendered: string;
  renderedPosition: IGame['rootPosition'];
  searches: number;
}
interface IScenarioContext {
  game: IGame;
  snapshot: ISnapshot;
  selected?: { tree: IGame['moveTree']; node: IMoveNode; path: number[]; moves: string[] };
}
const position = useGamePosition();
let store: ReturnType<typeof useGamesStore>;
function _moves(game: IGame, rendered: boolean = false) {
  return MoveHistoryService.getMoveSequence(game.moveTree, rendered ? game.renderedPath : game.livePath ?? []).map(getUci);
}
function _searches(game: IGame) { return external.turns.filter((turn) => turn.game === game).length; }
function _snapshot(game: IGame): ISnapshot {
  return { canonical: SerializationService.serialiseGame(game), clock: JSON.stringify(game.clockSnapshot), queue: game.$!.premoveQueue,
    rendered: buildFen(position.getRenderedPosition(game)), renderedPosition: position.getRenderedPosition(game), searches: _searches(game) };
}
function _detailed(board: IGame['rootPosition'], uci: string) {
  const move = genLegalMoves(board).find((candidate) => getUci(candidate) === uci);
  if (!move) throw new Error(`Invalid premove test fixture: ${uci} is illegal at ${buildFen(board)}.`);
  return move;
}
function _validateFixture(spec: IPremoveScenario) {
  for (const expected of [spec.expected, ...spec.events.map((event) => event.expected)]) {
    for (const line of [expected?.actual, expected?.rendered]) {
      const board = fixturePosition(spec.root);
      for (const uci of line ?? []) MoveApplicationService.applyMove(board, _detailed(board, uci));
    }
  }
}
async function _seed(spec: IPremoveScenario) {
  _validateFixture(spec);
  const colour = spec.local ?? PlayerColour.White;
  const whiteType = spec.seats === 'hotseat' || (spec.seats !== 'engines' && colour === PlayerColour.White) ? PlayerType.Local : PlayerType.Engine;
  const blackType = spec.seats === 'hotseat' || (spec.seats !== 'engines' && colour === PlayerColour.Black) ? PlayerType.Local : PlayerType.Engine;
  const clock = TimeControlService.initialiseClockSnapshot({ preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: spec.increment ?? 2000 });
  const game = createGame({ rootPosition: fixturePosition(spec.root), whitePlayer: fixturePlayer(PlayerColour.White, whiteType), blackPlayer: fixturePlayer(PlayerColour.Black, blackType),
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: spec.increment ?? 2000 }, clockSnapshot: clock,
    gameplayOptions: { allowTakeback: spec.allowTakeback ?? true, showLiveAnalysisMoves: true } });
  const board = MoveApplicationService.genPosition(game.rootPosition, []);
  let node = game.moveTree.root;
  for (const uci of spec.played ?? ['e2e4']) {
    const move = _detailed(board, uci);
    node = MoveHistoryService.addMainlineMove(node, move, clock);
    game.livePath!.push(node.$!.parent!.children.indexOf(node));
    MoveApplicationService.applyMove(board, move);
  }
  game.renderedPath = game.livePath!;
  game.gameState = board.sideToMove === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn;
  game.clockSnapshot = TimeControlService.startClock(clock, board.sideToMove, new ClockTimestamp());
  await store.insertGame(game);
  await flushPromises();
  if (spec.queue) {
    const player = localSeat(game, colour);
    game.$!.premoveQueue = { player: spec.clonePlayer ? { ...player } : player, moves: structuredClone([...spec.queue]) };
  }
  return { game, snapshot: _snapshot(game) } as IScenarioContext;
}
function _assert(context: IScenarioContext, expected: IPremoveExpected) {
  const game = context.game;
  const state = { actual: _moves(game), rendered: _moves(game, true), queue: game.$!.premoveQueue?.moves, searches: _searches(game),
    result: game.resultState, reason: game.resultReason, paused: game.$!.pauseReasons ?? [], active: game.clockSnapshot.activeColour,
    whiteMs: game.clockSnapshot.white.remainingMs, blackMs: game.clockSnapshot.black.remainingMs,
    running: game.clockSnapshot.white.isRunning || game.clockSnapshot.black.isRunning };
  for (const key of Object.keys(state) as Array<keyof typeof state>) {
    if (key in expected) expect(state[key], key).toEqual(expected[key]);
  }
  if (expected.actualPieces) _assertPieces(pieceMap(position.getLivePosition(game).board), expected.actualPieces);
  if (expected.renderedPieces) _assertPieces(pieceMap(position.getRenderedPosition(game).board), expected.renderedPieces);
  const now = _snapshot(game);
  for (const key of expected.unchanged ?? []) expect(now[key], `unchanged ${key}`).toBe(context.snapshot[key]);
  if (expected.unchanged?.includes('rendered')) expect(now.renderedPosition).toBe(context.snapshot.renderedPosition);
  if (expected.selectedAttached) _assertSelected(context);
  if (expected.lastMove) expect(position.getLiveNode(game).move).toMatchObject(expected.lastMove);
  for (const branch of expected.branches ?? []) expect(position.getNodeAtPath(game.moveTree, branch.path).children.map((node) => getUci(node.move!))).toEqual(branch.moves);
  if (game.$!.premoveQueue) expect(game.$!.premoveQueue.player).toBe(localSeat(game, game.$!.premoveQueue.player.colour));
}
function _assertPieces(actual: Record<string, string>, expected: Record<string, string | undefined>) {
  for (const [square, piece] of Object.entries(expected)) expect(actual[square], square).toBe(piece);
}
function _assertSelected(context: IScenarioContext) {
  const selected = context.selected!;
  const node = position.getNodeAtPath(context.game.moveTree, selected.path);
  expect(MoveHistoryService.getMoveSequence(context.game.moveTree, selected.path).map(getUci)).toEqual(selected.moves);
  if (selected.tree === context.game.moveTree) expect(node).toBe(selected.node);
}
async function _submit(game: IGame, move: IMoveRaw) { await store.makeMove(game, move); }
async function _reply(game: IGame, uci: string, late: boolean) {
  const turns = external.turns.filter((turn) => turn.game === game);
  const turn = late ? turns[0] : [...turns].reverse().find((item) => !item.delivered && !item.signal?.aborted);
  expect(turn, 'A genuine actual provider must have been started.').toBeDefined();
  const move = _detailed(turn!.position, uci);
  turn!.delivered = true;
  await turn!.deliver(move);
}
async function _clearPremoves(game: IGame) {
  const edit = Reflect.get(store, 'clearPremoves') as IQueueAction | undefined;
  expect(edit, 'Planned GamesStore.clearPremoves boundary is not implemented.').toBeTypeOf('function');
  await edit!(game);
}
async function _structural(context: IScenarioContext, event: IPremoveEvent) {
  const game = context.game;
  const colour = event.colour ?? PlayerColour.Black;
  switch (event.action) {
    case 'takeBack': return store.takeBack(game);
    case 'reassign': return store.reassignPlayer(game, colour, { ...fixturePlayer(colour, event.type ?? PlayerType.Local), ...(event.name ? { displayName: event.name } : {}) });
    case 'unassign': return store.reassignPlayer(game, colour, undefined);
    case 'resign': return store.resignGame(game, colour);
    case 'draw': await store.offerDraw(game); return store.acceptDrawOffer(game);
    case 'setup': return store.startGameFromSetup(game, { whitePlayer: fixturePlayer(PlayerColour.White, PlayerType.Local), blackPlayer: fixturePlayer(PlayerColour.Black, PlayerType.Local), analysisEngineProfiles: [], timeControl: game.timeControl });
    case 'timeout': return store.syncClock(game, new ClockTimestamp(game.clockSnapshot.startedAtUtc!.getTime() + 60000));
    case 'restore': context.game = await store.insertGame(SerializationService.deserialiseGame(SerializationService.serialiseGame(game))); return;
    case 'save': {
      const queue = game.$!.premoveQueue;
      const raw = SerializationService.serialiseGame(game);
      expect(raw).not.toContain('premoveQueue');
      expect(raw).not.toContain('redSquares');
      expect(SerializationService.deserialiseGame(raw).$).toBeUndefined();
      expect(game.$!.premoveQueue).toBe(queue);
      return;
    }
  }
}
async function _event(context: IScenarioContext, event: IPremoveEvent) {
  const game = context.game;
  switch (event.action) {
    case 'append': return _submit(game, event.intent!);
    case 'move': return _submit(game, premove(event.uci!));
    case 'reply': return _reply(game, event.uci!, false);
    case 'lateReply': return _reply(game, event.uci!, true);
    case 'analyse': return store.enterInGameAnalysis(game);
    case 'exit': return store.exitInGameAnalysis(game);
    case 'navigate': return store.navigateToNode(game, position.getNodeAtPath(game.moveTree, event.path!));
    case 'pause': return store.pauseGame(game, event.reason!);
    case 'resume': return store.resumeGame(game, event.reason!);
    case 'clear': return _clearPremoves(game);
    case 'tick': vi.setSystemTime(Date.now() + event.ms!); return;
    case 'remember':
      context.snapshot = _snapshot(game);
      context.selected = { tree: game.moveTree, node: position.getRenderedNode(game), path: [...game.renderedPath], moves: _moves(game, true) };
      return;
    default: return _structural(context, event);
  }
}
describe('premove scenario data through actual game actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    vi.clearAllMocks();
    external.turns.length = 0;
    external.settings = createSettingsSnapshot();
    external.settings.gameSession.autosaveAfterMoveCount = 0;
    store = useGamesStore();
  });
  afterEach(async () => {
    await Promise.allSettled(store.listGames().map((game) => store.reassignPlayer(game as IGame, PlayerColour.White, undefined)));
    vi.clearAllTimers();
    store.$dispose();
  });
  afterAll(() => vi.useRealTimers());
  it.each(premoveScenarios)('$id $name', async (spec) => {
    const context = await _seed(spec);
    for (const event of spec.events) {
      if (event.rejected) await expect(_event(context, event)).rejects.toThrow();
      else await _event(context, event);
      await flushPromises();
      if (event.expected) _assert(context, event.expected);
    }
    _assert(context, spec.expected);
  });
  it('PRE-S01 PRE-S22 copies accepted coordinates and discards caller-owned move metadata', async () => {
    const context = await _seed({ id: 'PRE-S01', name: 'input isolation', events: [], expected: {} });
    const input = { ...whiteChain[0]!, movingColour: PlayerColour.Black, movingPiece: PieceKind.Bishop, capturePiece: PieceKind.Queen, $: { san: 'stale notation', uci: 'stale coordinates' } };
    await _submit(context.game, input);
    const accepted = context.game.$!.premoveQueue!.moves[0];
    expect(accepted).toEqual(whiteChain[0]);
    expect(accepted).not.toBe(input);
    input.to = 0;
    _assert(context, { queue: [whiteChain[0]!], unchanged: ['canonical', 'clock', 'rendered', 'searches'] });
  });
  it('PRE-F08 PRE-S22 publishes append and cancellation without canonical effects', async () => {
    const context = await _seed({ id: 'PRE-S22', name: 'runtime publication', events: [], expected: {} });
    await store.addAnalysisEngine(context.game, createEngineRecord());
    await store.refreshAnalysis(context.game);
    context.snapshot = _snapshot(context.game);
    const before = store.workspaceRevision;
    const searches = vi.mocked(EngineRuntimeService.startAnalysis).mock.calls.length;
    const input = Object.freeze({ ...whiteChain[0]! });
    await _submit(context.game, input);
    expect(store.workspaceRevision).toBeGreaterThan(before);
    expect(context.game.$!.premoveQueue!.moves[0]).toEqual({ from: 6, to: 21 });
    expect(context.game.$!.premoveQueue!.moves[0]).not.toBe(input);
    _assert(context, { unchanged: ['canonical', 'clock', 'rendered', 'searches'] });
    const appended = store.workspaceRevision;
    await _clearPremoves(context.game);
    expect(store.workspaceRevision).toBeGreaterThan(appended);
    _assert(context, { queue: undefined, unchanged: ['canonical', 'clock', 'rendered', 'searches'] });
    const cleared = store.workspaceRevision;
    await _clearPremoves(context.game);
    expect(store.workspaceRevision).toBe(cleared);
    expect(EngineRuntimeService.startAnalysis).toHaveBeenCalledTimes(searches);
  });
  it.each([
    { name: 'empty source', move: premove('g3f5') }, { name: 'opposing source', move: premove('g8f6') },
    { name: 'wrong geometry', move: premove('g5g7') }, { name: 'friendly target', move: premove('g5e4') },
    { name: 'null move', move: premove('g5g5') }, { name: 'negative source', move: { from: -1, to: 21 } },
    { name: 'large target', move: { from: 38, to: 64 } }, { name: 'fractional source', move: { from: 38.5, to: 21 } },
    { name: 'fractional target', move: { from: 38, to: 21.5 } }, { name: 'non-pawn promotion', move: { ...premove('g5h7'), promotionPiece: PieceKind.Queen } },
  ])('PRE-S01 invalid append preserves the valid raw FIFO: $name', async ({ move }) => {
    const context = await _seed({ id: 'PRE-S01', name: 'invalid append', queue: whiteChain, events: [], expected: {} });
    const before = store.workspaceRevision;
    await expect(_submit(context.game, Object.freeze(move))).rejects.toThrow();
    _assert(context, { queue: whiteChain, unchanged: ['canonical', 'clock', 'queue', 'rendered', 'searches'] });
    expect(store.workspaceRevision).toBe(before);
  });
  it.each(['q', 'r', 'b', 'n'])('PRE-S04 derives the %s promotion dependency from the actual board', async (letter) => {
    const destination = letter === 'n' ? 'b6' : letter === 'b' ? 'c6' : 'a6';
    const first = premove(`a7a8${letter}`);
    const second = premove(`a8${destination}`);
    const actual = ['h7h6', `a7a8${letter}`, 'e8d7', `a8${destination}`];
    const context = await _seed({ id: 'PRE-S04', name: 'promoted dependency', root: promotionPosition, played: [], queue: [first, second], events: [], expected: { actual } });
    await _reply(context.game, 'h7h6', false);
    await flushPromises();
    _assert(context, { actual: ['h7h6', `a7a8${letter}`], queue: [second], searches: 2 });
    await _reply(context.game, 'e8d7', false);
    await flushPromises();
    _assert(context, { actual, queue: undefined, searches: 3,
      lastMove: { movingPiece: first.promotionPiece }, actualPieces: { a7: undefined, a8: undefined, [destination]: `white ${first.promotionPiece}` } });
  });
  it.each([undefined, PieceKind.King, PieceKind.Pawn])('PRE-S04 rejects an unfinished or invalid promotion choice: %s', async (promotionPiece) => {
    const context = await _seed({ id: 'PRE-S04', name: 'invalid promotion', root: promotionPosition, played: [], events: [], expected: {} });
    const move = { ...premove('a7a8'), ...(promotionPiece ? { promotionPiece } : {}) };
    await expect(_submit(context.game, move)).rejects.toThrow();
    _assert(context, { queue: undefined, unchanged: ['canonical', 'clock', 'rendered', 'searches'] });
  });
  it('PRE-S19 PRE-S21 two games consume and cancel only their own queues and providers', async () => {
    const spec = { id: 'PRE-S19', name: 'game isolation', queue: whiteChain, events: [], expected: {} };
    const first = await _seed(spec);
    const second = await _seed(spec);
    await store.pauseGame(first.game, PauseReason.Manual);
    await _reply(second.game, 'e7e5', false);
    await flushPromises();
    _assert(second, { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [whiteChain[1]!], searches: 2 });
    _assert(first, { actual: ['e2e4'], queue: whiteChain, searches: 1 });
    const remaining = _snapshot(second.game);
    await store.reassignPlayer(first.game, PlayerColour.Black, undefined);
    expect(first.game.$!.premoveQueue).toBeUndefined();
    expect(_snapshot(second.game)).toEqual(remaining);
  });
  it('PRE-F05 duplicate provider output cannot settle the following local turn', async () => {
    const context = await _seed({ id: 'PRE-S21', name: 'duplicate output', events: [], expected: {} });
    await _reply(context.game, 'e7e5', false);
    await flushPromises();
    const after = _snapshot(context.game);
    await expect(_reply(context.game, 'e7e5', true)).resolves.toBeUndefined();
    await flushPromises();
    expect(_snapshot(context.game)).toEqual(after);
    await _submit(context.game, premove('g1f3'));
    await flushPromises();
    _assert(context, { actual: ['e2e4', 'e7e5', 'g1f3'], searches: 2, queue: undefined });
  });
  it('PRE-F04 PRE-S23 repeated wake actions during readiness start one actual search', async () => {
    const ready = new Deferred<void>();
    vi.mocked(EngineRuntimeService.ensureReady).mockReturnValueOnce(ready);
    const context = await _seed({ id: 'PRE-S23', name: 'held readiness', queue: whiteChain, events: [], expected: {} });
    await store.enterInGameAnalysis(context.game);
    store.exitInGameAnalysis(context.game);
    store.exitInGameAnalysis(context.game);
    expect(EngineRuntimeService.ensureReady).toHaveBeenCalledOnce();
    expect(_searches(context.game)).toBe(0);
    ready.resolve();
    await flushPromises();
    expect(_searches(context.game)).toBe(1);
    await _reply(context.game, 'e7e5', false);
    await flushPromises();
    _assert(context, { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [whiteChain[1]!], searches: 2 });
  });
  it('PRE-F12 PRE-S21 cancellation during readiness closes the old provider before a late success', async () => {
    const ready = new Deferred<void>();
    vi.mocked(EngineRuntimeService.ensureReady).mockReturnValueOnce(ready);
    const context = await _seed({ id: 'PRE-S21', name: 'readiness cancellation', queue: whiteChain, events: [], expected: {} });
    await store.reassignPlayer(context.game, PlayerColour.Black, fixturePlayer(PlayerColour.Black, PlayerType.Local));
    const after = _snapshot(context.game);
    ready.resolve();
    await flushPromises();
    expect(EngineRuntimeService.startPlayerTurn).not.toHaveBeenCalled();
    expect(_snapshot(context.game)).toEqual(after);
    expect(context.game.$!.premoveQueue).toBeUndefined();
  });
  it('PRE-F04 a genuine provider failure retains intentions and retries the same actual turn once', async () => {
    const failure = new Error('Controlled readiness failure');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(EngineRuntimeService.ensureReady).mockRejectedValueOnce(failure);
      const context = await _seed({ id: 'PRE-S21', name: 'owned retry', queue: whiteChain, events: [], expected: {} });
      expect(report).toHaveBeenCalled();
      _assert(context, { actual: ['e2e4'], queue: whiteChain, searches: 0 });
      await vi.advanceTimersByTimeAsync(499);
      expect(EngineRuntimeService.ensureReady).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(EngineRuntimeService.ensureReady).toHaveBeenCalledTimes(2);
      expect(_searches(context.game)).toBe(1);
      await _reply(context.game, 'e7e5', false);
      await flushPromises();
      _assert(context, { actual: ['e2e4', 'e7e5', 'g1f3'], queue: [whiteChain[1]!], searches: 2 });
    } finally { report.mockRestore(); }
  });
  it('PRE-F12 cancellation removes an owned retry instead of leaving a timer for a replaced game', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(EngineRuntimeService.ensureReady).mockRejectedValueOnce(new Error('Controlled retry cancellation'));
      const context = await _seed({ id: 'PRE-S21', name: 'retry cancellation', queue: whiteChain, events: [], expected: {} });
      expect(vi.getTimerCount()).toBe(1);
      await store.reassignPlayer(context.game, PlayerColour.Black, undefined);
      expect(vi.getTimerCount()).toBe(0);
      const after = _snapshot(context.game);
      await vi.advanceTimersByTimeAsync(1000);
      await flushPromises();
      expect(_snapshot(context.game)).toEqual(after);
      expect(EngineRuntimeService.ensureReady).toHaveBeenCalledOnce();
    } finally { report.mockRestore(); }
  });
});
