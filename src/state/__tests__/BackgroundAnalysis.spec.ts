import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, PauseReason, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IAssignedEngine, type IGame, type IMove, type IPlayer } from '@/contracts';
import { TimeControlService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { createInitialBoardPosition, toDetailedMove } from '@/utility/chess';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createAssignedEngine, createGame, createSettingsSnapshot, stripRuntimeMetadata } from './StateStoreTestUtility';

interface ITestTurn { game: IGame; deliver: (move: IMove) => Promise<void>; signal?: AbortSignal; delivered: boolean; }
const external = vi.hoisted(() => ({ turns: [] as ITestTurn[], settings: undefined as ReturnType<typeof createSettingsSnapshot> | undefined }));
vi.mock('@/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain')>();
  return {
    ...actual,
    EngineRuntimeService: {
      ...actual.EngineRuntimeService,
      ensureReady: vi.fn(async () => {}),
      startPlayerTurn: vi.fn(async (_engine: IAssignedEngine, game: IGame, deliver: ITestTurn['deliver'], signal?: AbortSignal) => {
        external.turns.push({ game, deliver, signal, delivered: false });
      }),
      stopEngine: vi.fn(async () => {}),
    },
    PlatformEventService: { ...actual.PlatformEventService, subscribeToAppFocusReturned: vi.fn(() => () => {}) },
    UserSettingService: { ...actual.UserSettingService, getSettings: () => external.settings!, getSettingsOrDefault: async () => external.settings! },
  };
});
const position = useGamePosition();
let store: ReturnType<typeof useGamesStore>;
function _local(colour: PlayerColour): IPlayer {
  return { colour, type: PlayerType.Local, displayName: colour };
}
function _engine(colour: PlayerColour): IPlayer {
  return { ..._local(colour), type: PlayerType.Engine, assignedEngine: createAssignedEngine() } as IPlayer;
}
async function _start(white: IPlayer = _local(PlayerColour.White), black: IPlayer = _engine(PlayerColour.Black)) {
  const game = await store.createGame({ name: 'Background analysis', whitePlayer: white, blackPlayer: black, analysisEngineProfiles: [], allowTakeback: true,
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 2000 } });
  await flushPromises();
  return game;
}
function _detailed(game: IGame, from: number, to: number, live: boolean = false) {
  return toDetailedMove(live ? position.getLivePosition(game) : position.getRenderedPosition(game), { from, to });
}
async function _release(game: IGame, from: number, to: number) {
  const turn = [...external.turns].reverse().find((candidate) => candidate.game === game && !candidate.delivered && !candidate.signal?.aborted);
  if (!turn) throw new Error('Expected an armed actual engine turn.');
  turn.delivered = true;
  await turn.deliver(_detailed(game, from, to, true));
  await flushPromises();
}
async function _explore(game: IGame) {
  await store.enterInGameAnalysis(game);
  // Old analysis pauses are explicitly removed here to test isolation/progression independently.
  await store.resumeGame(game, PauseReason.Analysis);
}
describe('background analysis through game data and existing actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    external.turns.length = 0;
    external.settings = createSettingsSnapshot();
    external.settings.gameSession.autosaveAfterMoveCount = 0;
    store = useGamesStore();
  });
  afterEach(async () => {
    for (const game of store.listGames()) await store.reassignPlayer(game as IGame, PlayerColour.White, undefined);
    store.$dispose();
    vi.restoreAllMocks();
  });
  it('leaves running clock data unchanged on explicit analysis entry and exit', async () => {
    const game = await _start();
    const clock = game.clockSnapshot;
    await store.enterInGameAnalysis(game);
    expect(game.clockSnapshot).toBe(clock);
    expect(game.$?.pauseReasons ?? []).toEqual([]);
    expect(TimeControlService.getRemainingTime(game.clockSnapshot, new ClockTimestamp(clock.startedAtUtc!.getTime() + 5000)).white).toBe(55000);
    store.exitInGameAnalysis(game);
    expect(game.clockSnapshot).toBe(clock);
    expect(game.renderedPath).toBe(game.livePath);
  });
  it('keeps an equal-path selected board fixed before the first exploratory move', async () => {
    const game = await _start(_engine(PlayerColour.White));
    await _explore(game);
    const selected = position.getRenderedPosition(game);
    const selectedPath = game.renderedPath;
    await _release(game, 12, 28);
    expect(game.livePath).toHaveLength(1);
    expect(game.renderedPath).toBe(selectedPath);
    expect(game.renderedPath).toEqual([]);
    expect(position.getRenderedPosition(game)).toBe(selected);
    expect(selected.board[12]).toEqual({ colour: PlayerColour.White, kind: 'pawn' });
    expect(selected.board[28]).toBeUndefined();
    expect(position.getLivePosition(game).board[28]).toEqual({ colour: PlayerColour.White, kind: 'pawn' });
  });
  it('starts successive actual engine turns while analysis remains selected', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _explore(game);
    await _release(game, 12, 28);
    expect(external.turns).toHaveLength(2);
    await _release(game, 52, 36);
    expect(external.turns).toHaveLength(3);
    await _release(game, 6, 21);
    expect(game.livePath).toHaveLength(3);
    expect(game.renderedPath).toEqual([]);
    expect(external.turns).toHaveLength(4);
  });
  it('keeps history review distinct and explicitly analyses the selected historical move', async () => {
    const game = await _start();
    await store.makeMove(game, _detailed(game, 12, 28));
    store.navigateToNode(game, game.moveTree.root);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);
    await store.enterInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromBlackTurnWhiteMove);
    expect(game.renderedPath).toEqual([]);
    expect(position.getRenderedPosition(game).board[12]).toBeDefined();
    expect(game.clockSnapshot.black.isRunning).toBe(true);
  });
  it('continues successive actual turns behind ordinary history review', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _release(game, 12, 28);
    store.navigateToNode(game, game.moveTree.root);
    await _release(game, 52, 36);
    expect(external.turns).toHaveLength(3);
    expect(game.renderedPath).toEqual([]);
    expect(position.getRenderedPosition(game).board[12]).toBeDefined();
    expect(position.getLivePosition(game).board[36]).toBeDefined();
  });
  it('protects the active exploratory branch while actual mainline children are appended', async () => {
    const game = await _start(_engine(PlayerColour.White));
    await _explore(game);
    await store.makeMove(game, _detailed(game, 12, 28));
    await store.makeMove(game, _detailed(game, 52, 36));
    const selectedNode = position.getRenderedNode(game);
    const selected = position.getRenderedPosition(game);
    await _release(game, 11, 27);
    expect(position.isNodeInTree(game.moveTree, selectedNode)).toBe(true);
    expect(position.getRenderedPosition(game)).toBe(selected);
    expect(position.getRenderedNode(game)).toBe(selectedNode);
    expect(game.livePath).not.toEqual(game.renderedPath);
    store.exitInGameAnalysis(game);
    expect(game.renderedPath).toBe(game.livePath);
    expect(position.getLivePosition(game).board[27]).toBeDefined();
    expect(game.moveTree.root.children).toHaveLength(1);
    expect(position.isNodeInTree(game.moveTree, selectedNode)).toBe(false);
  });
  it('resumes real layered pauses without requiring analysis exit', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _explore(game);
    await store.pauseGame(game, PauseReason.Manual);
    await store.pauseGame(game, PauseReason.Menu);
    await _release(game, 12, 28);
    await store.resumeGame(game, PauseReason.Menu);
    expect(game.livePath).toEqual([]);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.livePath).toHaveLength(1);
    expect(game.renderedPath).toEqual([]);
    expect(external.turns).toHaveLength(2);
    expect(game.clockSnapshot.white.remainingMs).toBeGreaterThan(61000);
    expect(game.clockSnapshot.white.remainingMs).toBeLessThanOrEqual(62000);
  });
  it('adjudicates an actual clock timeout while its player explores', async () => {
    const game = await _start();
    const deadline = new ClockTimestamp(game.clockSnapshot.startedAtUtc!.getTime() + 61000);
    await store.enterInGameAnalysis(game);
    await store.makeMove(game, _detailed(game, 12, 28));
    await store.syncClock(game, deadline);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    expect(game.livePath).toEqual([]);
    expect(game.renderedPath).toHaveLength(1);
    store.exitInGameAnalysis(game);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.$?.pendingPlayerTurnPromise).toBeUndefined();
  });
  it('takes back actual play without creating an analysis-owned pause', async () => {
    const game = await _start();
    await store.makeMove(game, _detailed(game, 12, 28));
    await _release(game, 52, 36);
    await _explore(game);
    await store.makeMove(game, _detailed(game, 6, 21));
    await store.takeBack(game);
    expect(game.livePath).toEqual([]);
    expect(game.renderedPath).toBe(game.livePath);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.$?.pauseReasons ?? []).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
  });
  it('returns to current actual play without replaying output or restarting its search', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _explore(game);
    await _release(game, 12, 28);
    const clock = game.clockSnapshot;
    const searches = external.turns.length;
    store.exitInGameAnalysis(game);
    await flushPromises();
    expect(game.livePath).toHaveLength(1);
    expect(game.clockSnapshot).toBe(clock);
    expect(external.turns).toHaveLength(searches);
  });
  it('restores old paused analysis with only explicit Manual ownership', async () => {
    const initial = createGame({ rootPosition: createInitialBoardPosition(), gameState: GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove });
    initial.timeControl = { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 0 };
    initial.clockSnapshot = TimeControlService.pauseClock(TimeControlService.startClock(TimeControlService.initialiseClockSnapshot(initial.timeControl), PlayerColour.White, new ClockTimestamp()), new ClockTimestamp());
    const game = await store.insertGame(stripRuntimeMetadata(initial));
    expect(game.$?.pauseReasons).toEqual([PauseReason.Manual]);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromWhiteTurnWhiteMove);
    expect(game.renderedPath).not.toBe(game.livePath);
  });
});
