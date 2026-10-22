import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbiguityKind, CheckState, GameState, MoveKind, PauseReason, PieceKind, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IBoardPosition, type IGame, type IMoveRaw } from '@/contracts';
import { MoveHistoryService, SerializationService } from '@/domain';
import { buildFen, createInitialBoardPosition, createSparseBoard, getSan } from '@/utility/chess';
import { useGamesStore } from '../GamesStore';
import { useGamePosition } from '../game/GamePositionComposable';
import { createSettingsSnapshot } from './StateStoreTestUtility';
const external = vi.hoisted(() => ({ settings: undefined as ReturnType<typeof createSettingsSnapshot> | undefined }));
vi.mock('@/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain')>();
  return { ...actual,
    PlatformEventService: { ...actual.PlatformEventService, subscribeToAppFocusReturned: vi.fn(() => () => {}) },
    UserSettingService: { ...actual.UserSettingService, getSettings: () => external.settings!, getSettingsOrDefault: async () => external.settings! },
  };
});
const position = useGamePosition();
let store: ReturnType<typeof useGamesStore>;
function _sparse(pieces: Array<[number, PlayerColour, PieceKind]>, side = PlayerColour.White) {
  return createSparseBoard(pieces.map(([boardId, colour, kind]) => ({ boardId, piece: { colour, kind } })), side);
}
async function _start(rootPosition: IBoardPosition = createInitialBoardPosition(), live = true) {
  return store.createGame({ name: 'Raw submission', rootPosition, allowTakeback: true, analysisEngineProfiles: [],
    whitePlayer: live ? { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' } : undefined,
    blackPlayer: live ? { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' } : undefined,
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 2000 } });
}
describe('canonical raw move acceptance', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    external.settings = createSettingsSnapshot();
    external.settings.gameSession.autosaveAfterMoveCount = 0;
    store = useGamesStore();
  });
  afterEach(async () => {
    for (const game of store.listGames()) await store.reassignPlayer(game as IGame, PlayerColour.White, undefined);
    store.$dispose();
    vi.restoreAllMocks();
  });
  it('commits frozen raw input once with canonical details, clock increment and hotseat handoff', async () => {
    const game = await _start();
    const raw = Object.freeze({ from: 12, to: 28 });
    const previous = game.$!.pendingPlayerTurnPromise;
    await store.makeMove(game, raw);
    const node = position.getLiveNode(game);
    expect(node.move).toMatchObject({ ...raw, kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn });
    expect(getSan(node.move!)).toBe('e4');
    expect(game.livePath).toHaveLength(1);
    expect(game.renderedPath).toBe(game.livePath);
    expect(game.clockSnapshot.white.remainingMs).toBeGreaterThan(61000);
    expect(game.clockSnapshot.white.remainingMs).toBeLessThanOrEqual(62000);
    expect(game.clockSnapshot.black.isRunning).toBe(true);
    expect(game.$!.pendingPlayerTurnPromise).not.toBe(previous);
    await store.makeMove(game, { from: 52, to: 36 });
    expect(position.getLiveNode(game).move?.movingColour).toBe(PlayerColour.Black);
    expect(raw).toEqual({ from: 12, to: 28 });
  });
  it('ignores forged transition fields and caller notation caches without mutating the payload', async () => {
    const game = await _start();
    const raw = Object.freeze({ from: 12, to: 28, kind: MoveKind.Castle, movingPiece: PieceKind.King,
      movingColour: PlayerColour.Black, capturePiece: PieceKind.Queen, checkState: CheckState.Checkmate,
      ambiguityKind: AmbiguityKind.Both, $: Object.freeze({ san: 'forged', uci: 'a1a8' }) });
    await store.makeMove(game, raw);
    const move = position.getLiveNode(game).move!;
    expect(move).not.toBe(raw);
    expect(move).toMatchObject({ kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn });
    expect(move.capturePiece).toBeUndefined();
    expect(move.checkState).toBeUndefined();
    expect(move.ambiguityKind).toBeUndefined();
    expect(move.$).toBeUndefined();
    expect(getSan(move)).toBe('e4');
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(raw.$.san).toBe('forged');
  });
  it.each<IMoveRaw>([
    { from: -1, to: 28 }, { from: 12, to: 64 }, { from: 12.5, to: 28 }, { from: 12, to: NaN },
    { from: 20, to: 28 }, { from: 52, to: 36 }, { from: 12, to: 20, promotionPiece: PieceKind.Queen },
    { from: 12, to: 36 }, { from: 6, to: 12 },
  ])('rejects invalid raw $from-$to without cancelling the current actual turn', async (raw) => {
    const game = await _start();
    const before = buildFen(position.getLivePosition(game));
    const clock = game.clockSnapshot;
    const pending = game.$!.pendingPlayerTurnPromise;
    await expect(store.makeMove(game, raw)).rejects.toThrow();
    expect(buildFen(position.getLivePosition(game))).toBe(before);
    expect(game.moveTree.root.children).toHaveLength(0);
    expect(game.clockSnapshot).toBe(clock);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
  });
  it('derives en-passant capture from actual preceding moves', async () => {
    const game = await _start();
    for (const [from, to] of [[12, 28], [48, 40], [28, 36], [51, 35]]) await store.makeMove(game, { from: from!, to: to! });
    await store.makeMove(game, { from: 36, to: 43 });
    const move = position.getLiveNode(game).move!;
    expect(move).toMatchObject({ kind: MoveKind.EnPassant, capturePiece: PieceKind.Pawn });
    expect(getSan(move)).toBe('exd6');
    expect(position.getLivePosition(game).board[35]).toBeUndefined();
  });
  it('derives castling and relocates the rook without supplied kind', async () => {
    const root = _sparse([[4, PlayerColour.White, PieceKind.King], [7, PlayerColour.White, PieceKind.Rook], [60, PlayerColour.Black, PieceKind.King]]);
    root.castlingAvailability.whiteKingSide = true;
    const game = await _start(root);
    await store.makeMove(game, { from: 4, to: 6 });
    expect(position.getLiveNode(game).move?.kind).toBe(MoveKind.Castle);
    expect(getSan(position.getLiveNode(game).move!)).toBe('O-O');
    expect(position.getLivePosition(game).board[5]?.kind).toBe(PieceKind.Rook);
    expect(position.getLivePosition(game).board[7]).toBeUndefined();
  });
  it('computes SAN ambiguity from all pieces, rather than only the selected piece', async () => {
    const game = await _start(_sparse([[4, PlayerColour.White, PieceKind.King], [60, PlayerColour.Black, PieceKind.King],
      [1, PlayerColour.White, PieceKind.Knight], [5, PlayerColour.White, PieceKind.Knight]]));
    await store.makeMove(game, { from: 1, to: 11 });
    expect(getSan(position.getLiveNode(game).move!)).toBe('Nbd2');
  });
  it('records canonical checkmate notation and stops actual clocks for raw moves', async () => {
    const game = await _start();
    for (const [from, to] of [[13, 21], [52, 36], [14, 30], [59, 31]]) await store.makeMove(game, { from: from!, to: to! });
    expect(position.getLiveNode(game).move?.checkState).toBe(CheckState.Checkmate);
    expect(getSan(position.getLiveNode(game).move!)).toBe('Qh4#');
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    expect(game.clockSnapshot.black.isRunning).toBe(false);
  });
  it.each([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight])('accepts exact raw promotion to %s', async (promotionPiece) => {
    const game = await _start(_sparse([[4, PlayerColour.White, PieceKind.King], [60, PlayerColour.Black, PieceKind.King], [48, PlayerColour.White, PieceKind.Pawn]]));
    await store.makeMove(game, { from: 48, to: 56, promotionPiece });
    expect(position.getLiveNode(game).move).toMatchObject({ kind: MoveKind.Promotion, movingPiece: PieceKind.Pawn, promotionPiece });
    expect(position.getLivePosition(game).board[56]?.kind).toBe(promotionPiece);
  });
  it.each([undefined, PieceKind.King, PieceKind.Pawn])('rejects missing/invalid promotion %s', async (promotionPiece) => {
    const game = await _start(_sparse([[4, PlayerColour.White, PieceKind.King], [60, PlayerColour.Black, PieceKind.King], [48, PlayerColour.White, PieceKind.Pawn]]));
    await expect(store.makeMove(game, { from: 48, to: 56, promotionPiece })).rejects.toThrow();
    expect(game.moveTree.root.children).toHaveLength(0);
  });
  it.each([false, true])('keeps raw exploration independent with genuine pause %s', async (paused) => {
    const game = await _start();
    if (paused) await store.pauseGame(game, PauseReason.Manual);
    const clock = game.clockSnapshot;
    const pending = game.$!.pendingPlayerTurnPromise;
    await store.enterInGameAnalysis(game);
    await store.makeMove(game, { from: 12, to: 28 });
    expect(game.livePath).toEqual([]);
    expect(position.getLivePosition(game).board[12]?.kind).toBe(PieceKind.Pawn);
    expect(position.getRenderedPosition(game).board[28]?.kind).toBe(PieceKind.Pawn);
    expect(game.clockSnapshot).toBe(clock);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    expect(game.$!.pauseReasons ?? []).toEqual(paused ? [PauseReason.Manual] : []);
  });
  it('validates a raw history rewrite before cancelling actual work and preserves the old continuation', async () => {
    const game = await _start();
    await store.makeMove(game, { from: 12, to: 28 });
    store.navigateToNode(game, game.moveTree.root);
    const pending = game.$!.pendingPlayerTurnPromise;
    await expect(store.makeMove(game, { from: 12, to: 36 })).rejects.toThrow();
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    await store.makeMove(game, { from: 11, to: 27 });
    expect(game.moveTree.root.children).toHaveLength(2);
    expect(position.getLiveNode(game).move?.to).toBe(27);
    expect(game.moveTree.root.children[0]?.move?.to).toBe(28);
  });
  it('releases a history rewrite when analysis replaces its selected owner during settlement', async () => {
    const game = await _start();
    await store.makeMove(game, { from: 12, to: 28 });
    store.navigateToNode(game, game.moveTree.root);
    const rewriting = store.makeMove(game, { from: 11, to: 27 });
    await store.enterInGameAnalysis(game);
    await rewriting;
    expect(game.livePath).toEqual([0]);
    expect(game.moveTree.root.children).toHaveLength(1);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromBlackTurnWhiteMove);
    expect(game.$!.pendingPlayerTurnPromise).toBeDefined();
  });
  it('does not rewrite actual history if a genuine pause wins settlement', async () => {
    const game = await _start();
    await store.makeMove(game, { from: 12, to: 28 });
    store.navigateToNode(game, game.moveTree.root);
    const rewriting = store.makeMove(game, { from: 11, to: 27 });
    await store.pauseGame(game, PauseReason.Manual);
    await rewriting;
    expect(game.livePath).toEqual([0]);
    expect(game.moveTree.root.children).toHaveLength(1);
    expect(game.gameState).toBe(GameState.PausedBlackTurn);
    expect(game.$!.pauseReasons).toEqual([PauseReason.Manual]);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.$!.pendingPlayerTurnPromise).toBeDefined();
  });
  it('supports free/post-result raw exploration without reviving play and saves detailed history', async () => {
    const game = await _start(createInitialBoardPosition(), false);
    game.resultState = ResultState.BlackWon;
    await store.makeMove(game, { from: 12, to: 28 });
    expect(game.livePath).toBeUndefined();
    expect(game.gameState).toBe(GameState.AnalysisBlackMove);
    expect(game.resultState).toBe(ResultState.BlackWon);
    const snapshot = SerializationService.deserialiseGame(SerializationService.serialiseGame(game));
    expect(snapshot.moveTree.root.children[0]?.move?.movingPiece).toBe(PieceKind.Pawn);
    const loaded = await store.insertGame(snapshot);
    expect(getSan(MoveHistoryService.getMoveSequence(loaded.moveTree, loaded.renderedPath)[0]!)).toBe('e4');
  });
  it('holds a raw local acceptance if a genuine pause wins the delivery race', async () => {
    const game = await _start();
    const submitting = store.makeMove(game, { from: 12, to: 28 });
    const pausing = store.pauseGame(game, PauseReason.Manual);
    await Promise.all([submitting, pausing]);
    expect(game.livePath).toEqual([]);
    expect(game.$!.deferredPlayerMove).toMatchObject({ from: 12, to: 28, movingPiece: PieceKind.Pawn });
    await store.resumeGame(game, PauseReason.Manual);
    await flushPromises();
    expect(game.livePath).toHaveLength(1);
    expect(game.$!.deferredPlayerMove).toBeUndefined();
  });
});
