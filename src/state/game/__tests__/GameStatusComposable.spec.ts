import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GameState, PlayerColour, ResultReason, ResultState } from '@/contracts';
import { createGame, createOutgoingDrawOffer } from '@/state/__tests__/StateStoreTestUtility';
import { useGamePosition } from '../GamePositionComposable';
import { useGameStatus } from '../GameStatusComposable';
import { useGamesStore } from '../../GamesStore';
import { useGameRecord } from '../GameRecordComposable';
import { useGamePremove } from '../GamePremoveComposable';
import * as statusModule from '../GameStatusComposable';
import * as clockModule from '../GameClockComposable';
import * as turnRuntimeModule from '../GameTurnRuntimeComposable';

describe('useGameStatus', () => {
  afterEach(() => vi.restoreAllMocks());
  function _createSubject() {
    const position = useGamePosition();
    const record = useGameRecord();
    const premove = useGamePremove({ position });
    const turnRuntime = turnRuntimeModule.useGameTurnRuntime({ position });
    const status = useGameStatus({ position, record, premove });
    const clock = clockModule.useGameClock({ position, status, record, premove, turnRuntime });
    const timestampGame = vi.spyOn(record, 'timestampGame');
    const clearPlayerTurnRuntime = vi.spyOn(turnRuntime, 'clearPlayerTurnRuntime').mockResolvedValue(undefined);
    const refreshRuntimeRegistrations = vi.spyOn(clock, 'refreshRuntimeRegistrations').mockImplementation(() => {});
    vi.spyOn(statusModule, 'useGameStatus').mockReturnValue(status);
    vi.spyOn(clockModule, 'useGameClock').mockReturnValue(clock);
    vi.spyOn(turnRuntimeModule, 'useGameTurnRuntime').mockReturnValue(turnRuntime);
    const store = useGamesStore(createPinia());
    return { position, status, store, timestampGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations };
  }
  it('preserves the live state family while the side to move changes', () => {
    const { status } = _createSubject();
    const game = createGame({ gameState: GameState.PausedWhiteTurn });

    status.updateGameStateAfterPosition(game, PlayerColour.Black);

    expect(game.gameState).toBe(GameState.PausedBlackTurn);
  });
  it('finalises an accepted draw and invokes session teardown hooks', async () => {
    const { position, store, timestampGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = _createSubject();
    const game = position.hydrateGame(createGame({ drawOfferState: createOutgoingDrawOffer(PlayerColour.White) }));
    let completeTurnCancellation!: () => void;
    clearPlayerTurnRuntime.mockImplementationOnce(() => new Promise<void>((resolve) => completeTurnCancellation = resolve));

    const drawAcceptance = store.acceptDrawOffer(game);
    await Promise.resolve();

    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(timestampGame).not.toHaveBeenCalled();
    completeTurnCancellation();
    await drawAcceptance;
    expect(game.resultState).toBe(ResultState.Drawn);
    expect(game.resultReason).toBe(ResultReason.DrawAgreement);
    expect(game.drawOfferState).toBeUndefined();
    expect(clearPlayerTurnRuntime).toHaveBeenCalledWith(game);
    expect(refreshRuntimeRegistrations).toHaveBeenCalledWith(game);
    expect(timestampGame).toHaveBeenCalledWith(game);
  });
  it('rejects every result command after the game has ended', async () => {
    const { position, store, timestampGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = _createSubject();
    const game = position.hydrateGame(createGame({
      resultState: ResultState.WhiteWon,
      resultReason: ResultReason.RuleResolved,
      gameState: GameState.AnalysisBlackMove,
      drawOfferState: createOutgoingDrawOffer(PlayerColour.White),
    }));
    const actions = [
      () => store.resignGame(game, PlayerColour.Black),
      () => store.offerDraw(game),
      () => store.acceptDrawOffer(game),
      () => store.declineDrawOffer(game),
      () => store.withdrawDrawOffer(game),
    ];

    for (const action of actions) await expect(action()).rejects.toThrow('ongoing game at its live position');

    expect(game.resultState).toBe(ResultState.WhiteWon);
    expect(game.resultReason).toBe(ResultReason.RuleResolved);
    expect(game.drawOfferState).toEqual(createOutgoingDrawOffer(PlayerColour.White));
    expect(clearPlayerTurnRuntime).not.toHaveBeenCalled();
    expect(refreshRuntimeRegistrations).not.toHaveBeenCalled();
    expect(timestampGame).not.toHaveBeenCalled();
  });
  it('rejects result commands in explicit analysis but uses actual play during ordinary review', async () => {
    const { position, store } = _createSubject();
    const game = position.hydrateGame(createGame());
    game.gameState = GameState.LiveAnalysisFromWhiteTurnWhiteMove;

    await expect(store.resignGame(game, PlayerColour.White)).rejects.toThrow('ongoing game at its live position');

    game.gameState = GameState.LiveWhiteTurn;
    game.renderedPath = [0];
    await store.offerDraw(game);
    expect(game.drawOfferState?.offeringColour).toBe(PlayerColour.White);
  });
});
