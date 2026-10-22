import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, PauseReason, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IAssignedEngine, type IGame, type IMove, type IPlayer } from '@/contracts';
import { TimeControlService } from '@/domain';
import { ClockTimestamp } from '@/utility/date';
import { createInitialBoardPosition, toDetailedMove } from '@/utility/chess';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createAnalysisSeat, createAssignedEngine, createGame, createSettingsSnapshot, stripRuntimeMetadata } from './StateStoreTestUtility';

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
      startAnalysis: vi.fn(async () => {}),
      subscribeToAnalysis: vi.fn(() => () => {}),
      stopAnalysis: vi.fn(async () => {}),
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
  it('rejects raw manual input on an engine turn without replacing its provider', async () => {
    const game = await _start(_engine(PlayerColour.White));
    const pending = game.$!.pendingPlayerTurnPromise;
    await expect(store.makeMove(game, { from: 12, to: 28 })).rejects.toThrow('current local turn');
    expect(game.livePath).toEqual([]);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    expect(external.turns).toHaveLength(1);
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
    expect(game.moveTree.root.children).toHaveLength(2);
    expect(position.isNodeInTree(game.moveTree, selectedNode)).toBe(true);
    store.navigateToNode(game, selectedNode);
    expect(position.getRenderedNode(game)).toBe(selectedNode);
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
  it.each([PauseReason.Manual, PauseReason.Menu])('enters and exits paused analysis without releasing %s or its held reply', async (reason) => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await store.pauseGame(game, reason);
    const clock = game.clockSnapshot;
    const pending = game.$!.pendingPlayerTurnPromise;
    await store.enterInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    await _release(game, 12, 28);
    const held = game.$!.deferredPlayerMove;
    expect(held).toBeDefined();
    store.exitInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.PausedWhiteTurn);
    expect(game.clockSnapshot).toBe(clock);
    expect(game.$!.pauseReasons).toEqual([reason]);
    expect(game.$!.deferredPlayerMove).toBe(held);
    expect(game.livePath).toEqual([]);
    expect(external.turns).toHaveLength(1);
    await store.resumeGame(game, reason);
    expect(game.livePath).toHaveLength(1);
    expect(external.turns).toHaveLength(2);
  });
  it('preserves an already-held reply when entering paused analysis and resumes it exactly once', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await store.pauseGame(game, PauseReason.Manual);
    await _release(game, 12, 28);
    const held = game.$!.deferredPlayerMove;
    await store.enterInGameAnalysis(game);
    expect(game.$!.deferredPlayerMove).toBe(held);
    await store.resumeGame(game, PauseReason.Manual);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.livePath).toHaveLength(1);
    expect(game.renderedPath).toEqual([]);
    expect(game.$!.deferredPlayerMove).toBeUndefined();
    expect(external.turns).toHaveLength(2);
  });
  it('allows paused analysis moves and history while actual Takeback stays blocked', async () => {
    const game = await _start();
    await store.makeMove(game, _detailed(game, 12, 28));
    await store.pauseGame(game, PauseReason.Manual);
    const clock = game.clockSnapshot;
    await store.enterInGameAnalysis(game);
    await store.makeMove(game, _detailed(game, 51, 35));
    await store.makeMove(game, _detailed(game, 6, 21));
    const branch = position.getRenderedNode(game);
    store.navigateToNode(game, game.moveTree.root);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromBlackTurnWhiteMove);
    await expect(store.takeBack(game)).rejects.toThrow(/paused/i);
    expect(game.livePath).toEqual([0]);
    expect(game.clockSnapshot).toBe(clock);
    store.navigateToNode(game, branch);
    expect(game.gameState).toBe(GameState.PausedLiveAnalysisFromBlackTurnBlackMove);
    store.exitInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.PausedBlackTurn);
    expect(game.clockSnapshot).toBe(clock);
  });
  it('prunes current-move exploration only on the next actual move after Exit', async () => {
    const game = await _start();
    await _explore(game);
    await store.makeMove(game, _detailed(game, 11, 27));
    const branch = position.getRenderedNode(game);
    store.exitInGameAnalysis(game);
    expect(position.isNodeInTree(game.moveTree, branch)).toBe(true);
    await store.makeMove(game, _detailed(game, 12, 28));
    expect(position.isNodeInTree(game.moveTree, branch)).toBe(false);
    expect(game.moveTree.root.children).toHaveLength(1);
  });
  it('retains historical branches and independent selection across save-shaped hydration', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _explore(game);
    await store.makeMove(game, _detailed(game, 11, 27));
    const branchPath = [...game.renderedPath];
    await _release(game, 12, 28);
    store.exitInGameAnalysis(game);
    store.navigateToNode(game, position.getNodeAtPath(game.moveTree, branchPath));
    const restored = await store.insertGame(stripRuntimeMetadata(game));
    expect(restored.renderedPath).toEqual(branchPath);
    expect(position.getRenderedPosition(restored).board[27]).toBeDefined();
    expect(position.getLivePosition(restored).board[28]).toBeDefined();
    expect(restored.moveTree.root.children).toHaveLength(2);
  });
  it('rewrites actual history only when permitted and cancels the old actual provider', async () => {
    const game = await _start();
    await store.makeMove(game, _detailed(game, 12, 28));
    await flushPromises();
    const oldTurn = external.turns[0]!;
    store.navigateToNode(game, game.moveTree.root);
    await store.makeMove(game, _detailed(game, 11, 27));
    expect(oldTurn.signal!.aborted).toBe(true);
    expect(game.moveTree.root.children).toHaveLength(2);
    expect(game.renderedPath).toBe(game.livePath);
    expect(position.getLivePosition(game).board[27]).toBeDefined();
    const livePath = [...game.livePath!];
    await oldTurn.deliver(_detailed(game, 52, 36, true));
    expect(game.livePath).toEqual(livePath);
  });
  it('requires Analyse to explore history when Takeback is disabled', async () => {
    const game = await _start();
    game.gameplayOptions.allowTakeback = false;
    await store.makeMove(game, _detailed(game, 12, 28));
    store.navigateToNode(game, game.moveTree.root);
    await expect(store.makeMove(game, _detailed(game, 11, 27))).rejects.toThrow(/analysis/i);
    expect(game.livePath).toEqual([0]);
    await store.enterInGameAnalysis(game);
    await store.makeMove(game, _detailed(game, 11, 27));
    expect(game.livePath).toEqual([0]);
    expect(position.getRenderedPosition(game).board[27]).toBeDefined();
  });
  it('rejects a former local side after hotseat play hands the actual turn over', async () => {
    const game = await _start(_local(PlayerColour.White), _local(PlayerColour.Black));
    const oldMove = _detailed(game, 11, 27);
    await store.makeMove(game, _detailed(game, 12, 28));
    const pending = game.$!.pendingPlayerTurnPromise;
    await expect(store.makeMove(game, oldMove)).rejects.toThrow('not legal');
    expect(game.livePath).toEqual([0]);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    await store.makeMove(game, _detailed(game, 52, 36));
    expect(game.livePath).toHaveLength(2);
  });
  it('keeps actual result actions blocked in explicit analysis and uses actual side in ordinary review', async () => {
    const game = await _start();
    await store.makeMove(game, _detailed(game, 12, 28));
    store.navigateToNode(game, game.moveTree.root);
    await store.offerDraw(game);
    expect(game.drawOfferState?.offeringColour).toBe(PlayerColour.Black);
    await store.enterInGameAnalysis(game);
    await expect(store.offerDraw(game)).rejects.toThrow();
    await expect(store.resignGame(game, PlayerColour.Black)).rejects.toThrow();
    expect(game.resultState).toBe(ResultState.Ongoing);
  });
  it('lets an actual mating reply finish behind an unchanged analysis board without restarting play', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _release(game, 13, 21);
    await _release(game, 52, 36);
    await _release(game, 14, 30);
    await _explore(game);
    const selected = position.getRenderedPosition(game);
    await _release(game, 59, 31);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.clockSnapshot.white.isRunning || game.clockSnapshot.black.isRunning).toBe(false);
    expect(position.getRenderedPosition(game)).toBe(selected);
    expect(game.livePath).toHaveLength(4);
    expect(game.renderedPath).toHaveLength(3);
    store.navigateToNode(game, position.getLiveNode(game));
    expect(game.gameState).toBe(GameState.AnalysisWhiteMove);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.$!.pendingPlayerTurnPromise).toBeUndefined();
    expect(external.turns).toHaveLength(4);
  });
  it('does not adjudicate an actual result from a mating exploratory line', async () => {
    const game = await _start();
    await _explore(game);
    for (const [from, to] of [[13, 21], [52, 36], [14, 30], [59, 31]]) await store.makeMove(game, _detailed(game, from!, to!));
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
    expect(external.turns).toHaveLength(0);
  });
  it('does not archive unrelated selected evaluation on a background actual move', async () => {
    const game = await _start(_engine(PlayerColour.White), _engine(PlayerColour.Black));
    await _explore(game);
    await store.makeMove(game, _detailed(game, 11, 27));
    game.analysis.seats = [createAnalysisSeat()];
    await _release(game, 12, 28);
    expect(position.getLiveNode(game).recordedAnalysis).toBeUndefined();
    expect(position.getRenderedNode(game).recordedAnalysis).toBeUndefined();
  });
});
