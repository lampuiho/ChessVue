import { describe, expect, it, vi } from 'vitest';

import { GameState, PlayerColour, ResultReason, ResultState } from '@/contracts';
import { createGame, createOutgoingDrawOffer } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';
import { useGameStatus } from '../GameStatusComposable';

describe('useGameStatus', () => {
  function _createSubject() {
    const position = useGamePosition();
    const touchGame = vi.fn();
    const clearPlayerTurnRuntime = vi.fn(async () => {});
    const refreshRuntimeRegistrations = vi.fn();
    const status = useGameStatus({ position, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations, clearPremoves: vi.fn() });
    return { position, status, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations };
  }
  it('preserves the live state family while the side to move changes', () => {
    const { status } = _createSubject();
    const game = createGame({ gameState: GameState.PausedWhiteTurn });

    status.updateGameStateAfterPosition(game, PlayerColour.Black);

    expect(game.gameState).toBe(GameState.PausedBlackTurn);
  });
  it('finalises an accepted draw and invokes session teardown hooks', async () => {
    const { position, status, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = _createSubject();
    const game = position.hydrateGame(createGame({ drawOfferState: createOutgoingDrawOffer(PlayerColour.White) }));
    let completeTurnCancellation!: () => void;
    clearPlayerTurnRuntime.mockImplementationOnce(() => new Promise<void>((resolve) => completeTurnCancellation = resolve));

    const drawAcceptance = status.acceptDrawOffer(game);
    await Promise.resolve();

    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(touchGame).not.toHaveBeenCalled();
    completeTurnCancellation();
    await drawAcceptance;
    expect(game.resultState).toBe(ResultState.Drawn);
    expect(game.resultReason).toBe(ResultReason.DrawAgreement);
    expect(game.drawOfferState).toBeUndefined();
    expect(clearPlayerTurnRuntime).toHaveBeenCalledWith(game);
    expect(refreshRuntimeRegistrations).toHaveBeenCalledWith(game);
    expect(touchGame).toHaveBeenCalledWith(game);
  });
  it('rejects every result command after the game has ended', async () => {
    const { position, status, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = _createSubject();
    const game = position.hydrateGame(createGame({
      resultState: ResultState.WhiteWon,
      resultReason: ResultReason.RuleResolved,
      gameState: GameState.AnalysisBlackMove,
      drawOfferState: createOutgoingDrawOffer(PlayerColour.White),
    }));
    const actions = [
      () => status.resignGame(game, PlayerColour.Black),
      () => status.offerDraw(game),
      () => status.acceptDrawOffer(game),
      () => status.declineDrawOffer(game),
      () => status.withdrawDrawOffer(game),
    ];

    for (const action of actions) await expect(action()).rejects.toThrow('ongoing game at its live position');

    expect(game.resultState).toBe(ResultState.WhiteWon);
    expect(game.resultReason).toBe(ResultReason.RuleResolved);
    expect(game.drawOfferState).toEqual(createOutgoingDrawOffer(PlayerColour.White));
    expect(clearPlayerTurnRuntime).not.toHaveBeenCalled();
    expect(refreshRuntimeRegistrations).not.toHaveBeenCalled();
    expect(touchGame).not.toHaveBeenCalled();
  });
  it('rejects result commands in explicit analysis but uses actual play during ordinary review', async () => {
    const { position, status } = _createSubject();
    const game = position.hydrateGame(createGame());
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;

    await expect(status.resignGame(game, PlayerColour.White)).rejects.toThrow('ongoing game at its live position');

    game.gameState = GameState.LiveWhiteTurn;
    game.renderedPath = [0];
    await status.offerDraw(game);
    expect(game.drawOfferState?.offeringColour).toBe(PlayerColour.White);
  });
});
