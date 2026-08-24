import { describe, expect, it, vi } from 'vitest';

import { GameState, PlayerColour, ResultReason, ResultState } from '@/contracts';
import { createGame, createOutgoingDrawOffer } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';
import { useGameStatus } from '../GameStatusComposable';

describe('useGameStatus', () => {
  function createSubject() {
    const position = useGamePosition();
    const touchGame = vi.fn();
    const clearPlayerTurnRuntime = vi.fn();
    const refreshRuntimeRegistrations = vi.fn();
    const status = useGameStatus({ position, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations });
    return { position, status, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations };
  }
  it('preserves the live state family while the side to move changes', () => {
    const { status } = createSubject();
    const game = createGame({ gameState: GameState.PausedWhiteTurn });

    status.updateGameStateAfterPosition(game, PlayerColour.Black);

    expect(game.gameState).toBe(GameState.PausedBlackTurn);
  });
  it('finalises an accepted draw and invokes session teardown hooks', async () => {
    const { position, status, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = createSubject();
    const game = position.hydrateGame(createGame({ drawOfferState: createOutgoingDrawOffer(PlayerColour.White) }));

    await status.acceptDrawOffer(game);

    expect(game.resultState).toBe(ResultState.Drawn);
    expect(game.resultReason).toBe(ResultReason.DrawAgreement);
    expect(game.drawOfferState).toBeUndefined();
    expect(clearPlayerTurnRuntime).toHaveBeenCalledWith(game);
    expect(refreshRuntimeRegistrations).toHaveBeenCalledWith(game);
    expect(touchGame).toHaveBeenCalledWith(game);
  });
});
