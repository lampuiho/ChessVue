import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { computed, isReactive, isShallow, nextTick, toRaw } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineAvailability, PauseReason, PlayerColour, PlayerType, TimeControlPreset } from '@/contracts';
import { EngineRuntimeService, SerializationService } from '@/domain';
import { createInitialBoardPosition, getUci } from '@/utility/chess';
import HistoryPanel from '@/components/HistoryPanel.vue';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createEngineRecord, createGame, createSettingsSnapshot } from './StateStoreTestUtility';
import { fixturePlayer, whiteChain } from './PremoveFixture';

const external = vi.hoisted(() => ({ settings: undefined as ReturnType<typeof createSettingsSnapshot> | undefined }));
vi.mock('@/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain')>();
  return { ...actual,
    EngineRuntimeService: { ...actual.EngineRuntimeService, ensureReady: vi.fn(async () => {}), startPlayerTurn: vi.fn(async () => {}),
      stopEngine: vi.fn(async () => {}), startAnalysis: vi.fn(async () => {}), stopAnalysis: vi.fn(async () => {}) },
    PlatformEventService: { ...actual.PlatformEventService, subscribeToAppFocusReturned: vi.fn(() => () => {}) },
    UserSettingService: { ...actual.UserSettingService, getSettings: () => external.settings!, getSettingsOrDefault: async () => external.settings! },
  };
});
let store: ReturnType<typeof useGamesStore>;
const position = useGamePosition();
async function _start(engine = false) {
  return store.createGame({ name: 'Reactive game', rootPosition: createInitialBoardPosition(),
    whitePlayer: fixturePlayer(PlayerColour.White, PlayerType.Local),
    blackPlayer: fixturePlayer(PlayerColour.Black, engine ? PlayerType.Engine : PlayerType.Local),
    analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: true,
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 2000 } });
}
describe('game data drives Vue without publication counters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    external.settings = createSettingsSnapshot();
    external.settings.gameSession.autosaveAfterMoveCount = 0;
    vi.clearAllMocks();
    store = useGamesStore();
  });
  afterEach(() => { store.$dispose(); });
  it('PUB-S01 returns one reactive canonical game backed by the inserted payload', async () => {
    const payload = createGame({ rootPosition: createInitialBoardPosition() });
    const inserted = await store.insertGame(payload);
    expect(isReactive(inserted)).toBe(true);
    expect(toRaw(inserted)).toBe(payload);
    expect(store.getGame(inserted.metadata.id)).toBe(inserted);
    expect(store.listGames().find((game) => game.metadata.id === inserted.metadata.id)).toBe(inserted);
    const name = computed(() => store.getGame(inserted.metadata.id)?.metadata.name);
    expect(name.value).toBe(inserted.metadata.name);
    inserted.metadata.name = 'Renamed game';
    expect(name.value).toBe('Renamed game');
    expect(payload.metadata.name).toBe('Renamed game');
  });
  it('PUB-S02 PUB-S03 tracks membership and individual names without invalidating another game', async () => {
    const first = await _start();
    const second = await _start();
    const other = computed(() => ({ name: store.getGame(second.metadata.id)?.metadata.name }));
    const names = computed(() => store.listGames().map((game) => game.metadata.name));
    const previous = other.value;
    expect(names.value).toEqual(['Reactive game', 'Reactive game']);
    first.metadata.name = 'First changed';
    expect(names.value).toEqual(['First changed', 'Reactive game']);
    expect(other.value).toBe(previous);
    const payload = createGame();
    const missing = computed(() => store.getGame(payload.metadata.id));
    expect(missing.value).toBeUndefined();
    const inserted = await store.insertGame(payload);
    expect(missing.value).toBe(inserted);
  });
  it('PUB-S04 PUB-S07 updates history from in-place nodes/paths and preserves selected aliases', async () => {
    const game = await _start();
    const board = mount(HistoryPanel, { props: { root: game.moveTree.root, renderedPath: game.renderedPath, livePath: game.livePath } });
    const line = computed(() => game.livePath!.length);
    expect(line.value).toBe(0);
    await store.makeMove(game, { from: 12, to: 28 });
    await nextTick();
    expect(line.value).toBe(1);
    expect(board.findAll('.history-row')).toHaveLength(1);
    expect(game.renderedPath).toBe(game.livePath);
    expect(position.getRenderedNode(game)).toBe(game.moveTree.root.children[0]);
    expect(position.getRenderedPosition(game)).toBe(position.getLivePosition(game));
    await store.makeMove(game, { from: 52, to: 36 });
    await nextTick();
    expect(board.findAll('.history-row')).toHaveLength(2);
    board.unmount();
  });
  it('PUB-S05 observes queue mutations and retains exact supplied move references without timestamping', async () => {
    const game = await _start(true);
    await store.makeMove(game, { from: 12, to: 28 });
    const queue = computed(() => game.$?.premoveQueue?.moves.map(getUci) ?? []);
    const before = SerializationService.serialiseGame(game);
    expect(queue.value).toEqual([]);
    await store.makeMove(game, whiteChain[0]!);
    expect(queue.value).toEqual(['g1f3']);
    expect(game.$!.premoveQueue!.moves[0]).toBe(whiteChain[0]);
    expect(game.$!.premoveQueue!.player).toBe(game.whitePlayer);
    await store.makeMove(game, whiteChain[1]!);
    expect(queue.value).toEqual(['g1f3', 'f3g5']);
    store.clearPremoves(game);
    expect(queue.value).toEqual([]);
    expect(SerializationService.serialiseGame(game)).toBe(before);
  });
  it('PUB-S06 observes accepted analysis fields and uses the canonical game in engine startup', async () => {
    const game = await _start();
    await store.addAnalysisEngine(game, createEngineRecord());
    await store.refreshAnalysis(game);
    const seat = game.analysis.seats[0]!;
    expect(isReactive(seat.assignedEngine.$)).toBe(true);
    expect(isShallow(seat.assignedEngine.$)).toBe(true);
    expect(isReactive(seat.assignedEngine.$!.analysisLines)).toBe(false);
    const score = computed(() => seat.lines[0]?.scoreCp);
    expect(score.value).toBeUndefined();
    seat.assignedEngine.$!.analysisCallback!({ position: position.getRenderedPosition(game), lines: [{ depth: 12, scoreCp: 27, pv: [] }], isFinal: false });
    expect(score.value).toBe(27);
    const availability = computed(() => seat.assignedEngine.$!.availability);
    expect(availability.value).toBeDefined();
    seat.assignedEngine.$!.availability = EngineAvailability.Failed;
    expect(availability.value).toBe(EngineAvailability.Failed);
    expect(vi.mocked(EngineRuntimeService.startAnalysis).mock.calls[0]![1]).toBe(game);
  });
  it('PUB-S09 PUB-S11 observes pause ownership and preserves work across timestamp-only updates', async () => {
    const game = await _start();
    const paused = computed(() => game.$!.pauseReasons?.includes(PauseReason.Manual) ?? false);
    expect(paused.value).toBe(false);
    await store.pauseGame(game, PauseReason.Manual);
    expect(paused.value).toBe(true);
    await store.resumeGame(game, PauseReason.Manual);
    expect(paused.value).toBe(false);
    await flushPromises();
    expect(game.$!.pendingPlayerTurnPromise).toBeDefined();
    const before = JSON.parse(SerializationService.serialiseGame(game));
    const updatedAt = game.metadata.updatedAt;
    const clock = game.clockSnapshot;
    const pending = game.$!.pendingPlayerTurnPromise;
    const handler = game.$!.pendingPlayerTurnHandlePromise;
    const abort = game.$!.pendingPlayerTurnAbortController;
    const analysisStarts = vi.mocked(EngineRuntimeService.startAnalysis).mock.calls.length;
    store.navigateToNode(game, position.getRenderedNode(game));
    expect(game.metadata.updatedAt).not.toBe(updatedAt);
    expect(JSON.parse(SerializationService.serialiseGame(game))).toEqual({ ...before, metadata: { ...before.metadata, updatedAt: game.metadata.updatedAt.toISOString() } });
    expect(game.clockSnapshot).toBe(clock);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    expect(game.$!.pendingPlayerTurnHandlePromise).toBe(handler);
    expect(game.$!.pendingPlayerTurnAbortController).toBe(abort);
    expect(EngineRuntimeService.startAnalysis).toHaveBeenCalledTimes(analysisStarts);
  });
});
