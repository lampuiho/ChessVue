import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, PauseReason, PlayerColour, PlayerType, TimeControlPreset, type IAssignedEngine, type IGame, type IMove, type IMoveNode, type IPremove, type IPremoveQueue } from '@/contracts';
import { EngineRuntimeService, MoveApplicationService, MoveHistoryService, SerializationService, TimeControlService } from '@/domain';
import { buildFen, genLegalMoves, getUci } from '@/utility/chess';
import { ClockTimestamp } from '@/utility/date';
import { Deferred } from '@/utility/async/Deferred';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createGame, createSettingsSnapshot } from './StateStoreTestUtility';
import { fixturePlayer, fixturePosition, localSeat, pieceMap, whiteChain } from './PremoveFixture';
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
async function _submit(game: IGame, move: IMove | IPremove) {
  // The plan broadens this existing boundary; the cast adds no test-side implementation.
  const submit = store.makeMove as (game: IGame, input: IMove | IPremove) => Promise<void>;
  await submit(game, move);
}
async function _reply(game: IGame, uci: string, late: boolean) {
  const turns = external.turns.filter((turn) => turn.game === game);
  const turn = late ? turns[0] : [...turns].reverse().find((item) => !item.delivered && !item.signal?.aborted);
  expect(turn, 'A genuine actual provider must have been started.').toBeDefined();
  const move = _detailed(turn!.position, uci);
  turn!.delivered = true;
  await turn!.deliver(move);
}
async function _queueEdit(game: IGame, action: 'undoPremove' | 'clearPremoves') {
  const edit = Reflect.get(store, action) as IQueueAction | undefined;
  expect(edit, `Planned GamesStore.${action} boundary is not implemented.`).toBeTypeOf('function');
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
    case 'move': return _submit(game, _detailed(position.getRenderedPosition(game), event.uci!));
    case 'reply': return _reply(game, event.uci!, false);
    case 'lateReply': return _reply(game, event.uci!, true);
    case 'analyse': return store.enterInGameAnalysis(game);
    case 'exit': return store.exitInGameAnalysis(game);
    case 'navigate': return store.navigateToNode(game, position.getNodeAtPath(game.moveTree, event.path!));
    case 'pause': return store.pauseGame(game, event.reason!);
    case 'resume': return store.resumeGame(game, event.reason!);
    case 'undo': return _queueEdit(game, 'undoPremove');
    case 'clear': return _queueEdit(game, 'clearPremoves');
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
    const input = { ...whiteChain[0]!, movingColour: PlayerColour.White, capturePiece: 'stale capture', $: { notation: 'stale notation' } };
    await _submit(context.game, input);
    const accepted = context.game.$!.premoveQueue!.moves[0];
    expect(accepted).toEqual(whiteChain[0]);
    expect(accepted).not.toBe(input);
    input.to = 0;
    _assert(context, { queue: [whiteChain[0]!], unchanged: ['canonical', 'clock', 'rendered', 'searches'] });
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
    await _submit(context.game, _detailed(position.getLivePosition(context.game), 'g1f3'));
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
