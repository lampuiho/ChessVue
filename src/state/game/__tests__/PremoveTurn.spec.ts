import { describe, expect, it, vi } from 'vitest';
import { GameState, PieceKind, PlayerColour, PlayerType, type IEnginePlayer } from '@/contracts';
import { MoveApplicationService } from '@/domain';
import { createInitialBoardPosition, toDetailedMove } from '@/utility/chess';
import { createGame, createAssignedEngine } from '../../__tests__/StateStoreTestUtility';
import { whiteChain } from '../../__tests__/PremoveFixture';
import { useGamePosition } from '../GamePositionComposable';
import { useGameStatus } from '../GameStatusComposable';
import { useGamePlayerTurn } from '../GamePlayerTurnComposable';
import { useGameAnalysis } from '../GameAnalysisComposable';
import { useGameClock } from '../GameClockComposable';
import { useGameMove } from '../GameMoveComposable';
import { useGameRecord } from '../GameRecordComposable';
import { useGamePremove } from '../GamePremoveComposable';
import { useGameTurnRuntime } from '../GameTurnRuntimeComposable';

function _context() {
  const position = useGamePosition();
  const game = position.hydrateGame(createGame({ rootPosition: createInitialBoardPosition(), gameState: GameState.LiveWhiteTurn,
    whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'Human' },
    blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Engine, displayName: 'Engine', assignedEngine: createAssignedEngine() } as IEnginePlayer,
  }));
  game.renderedPath = game.livePath!;
  const record = useGameRecord();
  const premove = useGamePremove({ position });
  const clearPremoves = vi.spyOn(premove, 'clearPremoves');
  const turnRuntime = useGameTurnRuntime({ position });
  const status = useGameStatus({ position, record, premove });
  const analysis = useGameAnalysis({ position, record });
  const clock = useGameClock({ position, status, record, premove, turnRuntime });
  const move = useGameMove({ position, status, clock, analysis, record, premove });
  const commit = vi.spyOn(move, 'commitLiveMove').mockReturnValue(undefined);
  const turn = useGamePlayerTurn({ position, status, record, premove, move, clock, turnRuntime });
  game.$!.premoveQueue = { player: game.whitePlayer!, moves: [...whiteChain] };
  return { game, turn, commit, clearPremoves, position };
}
describe('premove answers the ordinary Local turn request', () => {
  it('registers the original Deferred and shifts once before normal handler settlement', async () => {
    const { game, turn, commit, position } = _context();
    const projection = vi.spyOn(position, 'getPremoveProjection');
    turn.requestPlayerMoveIfNeeded(game);
    const pending = game.$!.pendingPlayerTurnPromise!;
    const handling = game.$!.pendingPlayerTurnHandlePromise!;
    expect(pending).toBeDefined();
    expect(game.$!.pendingPlayerTurnAbortController).toBeDefined();
    expect(game.$!.premoveQueue!.moves).toEqual([whiteChain[1]]);
    turn.requestPlayerMoveIfNeeded(game);
    expect(game.$!.pendingPlayerTurnPromise).toBe(pending);
    expect(projection).not.toHaveBeenCalled();
    await expect(pending).resolves.toMatchObject({ ...whiteChain[0], movingColour: PlayerColour.White });
    await handling;
    expect(commit).toHaveBeenCalledOnce();
    expect(game.$!.pendingPlayerTurnPromise).toBeUndefined();
  });
  it('uses the existing held slot when pause follows synchronous shift and resolves on Resume', async () => {
    const { game, turn, commit } = _context();
    turn.requestPlayerMoveIfNeeded(game);
    const handling = game.$!.pendingPlayerTurnHandlePromise!;
    game.gameState = GameState.PausedWhiteTurn;
    await handling;
    expect(commit).not.toHaveBeenCalled();
    expect(game.$!.deferredPlayerMove).toMatchObject(whiteChain[0]!);
    expect(game.$!.premoveQueue!.moves).toEqual([whiteChain[1]]);
    game.gameState = GameState.LiveWhiteTurn;
    await turn.flushDeferredPlayerMove(game);
    expect(commit).toHaveBeenCalledOnce();
    expect(game.$!.deferredPlayerMove).toBeUndefined();
    expect(game.$!.premoveQueue!.moves).toEqual([whiteChain[1]]);
  });
  it('keeps the same request waiting after an illegal head, allowing ordinary input', async () => {
    const { game, turn, clearPremoves, commit } = _context();
    game.$!.premoveQueue!.moves[0] = { from: 6, to: 22 };
    turn.requestPlayerMoveIfNeeded(game);
    const pending = game.$!.pendingPlayerTurnPromise!;
    expect(clearPremoves).toHaveBeenCalledWith(game);
    const move = toDetailedMove(game.rootPosition, whiteChain[0]!);
    await turn.attemptPlayerMove(game, move);
    await expect(pending).resolves.toBe(move);
    expect(commit).toHaveBeenCalledExactlyOnceWith(game, move);
  });
  it('projects a whole chain with one simulation copy and no mutation of supplied moves', () => {
    const { game, position } = _context();
    const clone = vi.spyOn(MoveApplicationService, 'genPosition');
    const before = JSON.stringify(game.rootPosition);
    const projection = position.getPremoveProjection(game.rootPosition, game.$!.premoveQueue);
    expect(clone).toHaveBeenCalledOnce();
    expect(projection.position.board[38]).toMatchObject({ kind: PieceKind.Knight, colour: PlayerColour.White });
    expect(projection.redSquares).toEqual(new Set([6, 21, 38]));
    expect(JSON.stringify(game.rootPosition)).toBe(before);
    clone.mockRestore();
  });
});
