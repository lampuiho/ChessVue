import {
  DrawOfferDirection,
  GameState,
  PlayerColour,
  ResultReason,
  ResultState,
  type IBoardPosition,
  type IGame,
  type MovePath,
} from '@/contracts';
import { resolveGameResult } from '@/utility/chess';
import { getOpponentColour } from '@/utility/chess/BoardUtility';
import type { GamePositionComposable } from './GamePositionComposable';

type LiveGame = IGame & { livePath: MovePath };
interface IGameStatusDependency {
  position: GamePositionComposable;
  touchGame: (game: IGame) => void;
  clearPlayerTurnRuntime: (game: IGame) => void;
  refreshRuntimeRegistrations: (game: IGame) => void;
}

export function useGameStatus(dependency: IGameStatusDependency) {
  const { position, touchGame, clearPlayerTurnRuntime, refreshRuntimeRegistrations } = dependency;
  function isLiveState(state: GameState): boolean {
    return state === GameState.LiveWhiteTurn || state === GameState.LiveBlackTurn;
  }
  function isPausedLiveState(state: GameState): boolean {
    return state === GameState.PausedWhiteTurn || state === GameState.PausedBlackTurn;
  }
  function isLiveAnalysisState(state: GameState): boolean {
    return state === GameState.LiveAnalysisFromWhiteTurnWhiteMove
      || state === GameState.LiveAnalysisFromWhiteTurnBlackMove
      || state === GameState.LiveAnalysisFromBlackTurnWhiteMove
      || state === GameState.LiveAnalysisFromBlackTurnBlackMove;
  }
  function isPausedLiveAnalysisState(state: GameState): boolean {
    return state === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
      || state === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
      || state === GameState.PausedLiveAnalysisFromBlackTurnWhiteMove
      || state === GameState.PausedLiveAnalysisFromBlackTurnBlackMove;
  }
  function isPausedState(state: GameState): boolean {
    return isPausedLiveState(state) || isPausedLiveAnalysisState(state);
  }
  function isAnyLiveAnalysisState(state: GameState): boolean {
    return isLiveAnalysisState(state) || isPausedLiveAnalysisState(state);
  }
  function isAnalysisState(state: GameState): boolean {
    return state === GameState.AnalysisWhiteMove || state === GameState.AnalysisBlackMove || isAnyLiveAnalysisState(state);
  }
  function isLiveTurnReadyForMove(game: IGame): boolean {
    return isLiveState(game.gameState) && game.resultState === ResultState.Ongoing && !!game.livePath && position.pathsEqual(game.renderedPath, game.livePath);
  }
  function getAnalysisState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.AnalysisWhiteMove : GameState.AnalysisBlackMove;
  }
  function getLiveState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn;
  }
  function getPausedState(colour: PlayerColour): GameState {
    return colour === PlayerColour.White ? GameState.PausedWhiteTurn : GameState.PausedBlackTurn;
  }
  function getLiveAnalysisState(liveColour: PlayerColour, currentColour: PlayerColour, isPaused: boolean = false): GameState {
    if (liveColour === PlayerColour.White) {
      if (currentColour === PlayerColour.White) return isPaused ? GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove : GameState.LiveAnalysisFromWhiteTurnWhiteMove;
      return isPaused ? GameState.PausedLiveAnalysisFromWhiteTurnBlackMove : GameState.LiveAnalysisFromWhiteTurnBlackMove;
    }
    if (currentColour === PlayerColour.White) return isPaused ? GameState.PausedLiveAnalysisFromBlackTurnWhiteMove : GameState.LiveAnalysisFromBlackTurnWhiteMove;
    return isPaused ? GameState.PausedLiveAnalysisFromBlackTurnBlackMove : GameState.LiveAnalysisFromBlackTurnBlackMove;
  }
  function getLiveAnchorColour(game: IGame): PlayerColour {
    if (
      game.gameState === GameState.LiveAnalysisFromWhiteTurnWhiteMove
      || game.gameState === GameState.LiveAnalysisFromWhiteTurnBlackMove
      || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnWhiteMove
      || game.gameState === GameState.PausedLiveAnalysisFromWhiteTurnBlackMove
    ) return PlayerColour.White;
    return PlayerColour.Black;
  }
  function updateGameStateAfterPosition(game: IGame, positionColour: PlayerColour): void {
    if (game.resultState !== ResultState.Ongoing) game.gameState = getAnalysisState(positionColour);
    else if (isLiveState(game.gameState)) game.gameState = getLiveState(positionColour);
    else if (isPausedLiveState(game.gameState)) game.gameState = getPausedState(positionColour);
    else if (isAnyLiveAnalysisState(game.gameState)) game.gameState = getLiveAnalysisState(getLiveAnchorColour(game), positionColour, isPausedLiveAnalysisState(game.gameState));
    else game.gameState = getAnalysisState(positionColour);
  }
  function updateGameResultFromLivePosition(game: IGame, boardPosition: IBoardPosition): void {
    const resolvedResult = resolveGameResult(boardPosition);
    game.resultState = resolvedResult.resultState;
    game.resultReason = resolvedResult.resultReason;
  }
  function assertNotPausedForAction(game: IGame, action: string): void {
    if (!isPausedState(game.gameState)) return;
    throw new Error(`${action} is not allowed while gameState is ${game.gameState}.`);
  }
  function assertOngoingLiveAction(game: IGame, action: string): void {
    assertNotPausedForAction(game, action);
    if (isLiveTurnReadyForMove(game)) return;
    throw new Error(`${action} is only allowed for an ongoing game at its live position.`);
  }
  function assertMoveAllowed(game: IGame): void {
    switch (game.gameState) {
      case GameState.LiveWhiteTurn:
      case GameState.LiveBlackTurn:
      case GameState.AnalysisWhiteMove:
      case GameState.AnalysisBlackMove:
      case GameState.LiveAnalysisFromWhiteTurnWhiteMove:
      case GameState.LiveAnalysisFromWhiteTurnBlackMove:
      case GameState.LiveAnalysisFromBlackTurnWhiteMove:
      case GameState.LiveAnalysisFromBlackTurnBlackMove:
        return;
      default:
        throw new Error(`Move submission is not allowed while gameState is ${game.gameState}.`);
    }
  }
  function isOngoingLiveGame(game: IGame): game is LiveGame {
    return game.resultState === ResultState.Ongoing && !!game.livePath;
  }
  function isLiveHistoryReview(game: LiveGame): boolean {
    return position.isPathPrefix(game.renderedPath, game.livePath);
  }
  async function resignGame(game: IGame, colour: PlayerColour): Promise<void> {
    assertOngoingLiveAction(game, 'Resignation');
    game.resultState = colour === PlayerColour.White ? ResultState.BlackWon : ResultState.WhiteWon;
    game.resultReason = ResultReason.Resignation;
    game.gameState = getAnalysisState(getOpponentColour(colour));
    game.drawOfferState = undefined;
    clearPlayerTurnRuntime(game);
    touchGame(game);
    refreshRuntimeRegistrations(game);
  }
  async function offerDraw(game: IGame): Promise<void> {
    assertOngoingLiveAction(game, 'Draw offer');
    const offeringColour = position.getRenderedPosition(game).sideToMove;
    game.drawOfferState = { offeringColour, respondingColour: getOpponentColour(offeringColour), direction: DrawOfferDirection.Outgoing };
    touchGame(game);
  }
  async function acceptDrawOffer(game: IGame): Promise<void> {
    assertOngoingLiveAction(game, 'Draw acceptance');
    if (!game.drawOfferState) return;
    game.resultState = ResultState.Drawn;
    game.resultReason = ResultReason.DrawAgreement;
    game.gameState = getAnalysisState(position.getRenderedPosition(game).sideToMove);
    game.drawOfferState = undefined;
    clearPlayerTurnRuntime(game);
    touchGame(game);
    refreshRuntimeRegistrations(game);
  }
  async function declineDrawOffer(game: IGame): Promise<void> {
    assertOngoingLiveAction(game, 'Draw decline');
    game.drawOfferState = undefined;
    touchGame(game);
  }
  async function withdrawDrawOffer(game: IGame): Promise<void> {
    assertOngoingLiveAction(game, 'Draw withdrawal');
    if (game.drawOfferState?.direction === DrawOfferDirection.Outgoing) game.drawOfferState = undefined;
    touchGame(game);
  }
  return {
    isLiveState,
    isPausedLiveState,
    isPausedState,
    isLiveAnalysisState,
    isPausedLiveAnalysisState,
    isAnyLiveAnalysisState,
    isAnalysisState,
    isLiveTurnReadyForMove,
    getAnalysisState,
    getLiveState,
    getPausedState,
    getLiveAnalysisState,
    getLiveAnchorColour,
    updateGameStateAfterPosition,
    updateGameResultFromLivePosition,
    assertNotPausedForAction,
    assertOngoingLiveAction,
    assertMoveAllowed,
    isOngoingLiveGame,
    isLiveHistoryReview,
    resignGame,
    offerDraw,
    acceptDrawOffer,
    declineDrawOffer,
    withdrawDrawOffer,
  };
}
export type GameStatusComposable = ReturnType<typeof useGameStatus>;
