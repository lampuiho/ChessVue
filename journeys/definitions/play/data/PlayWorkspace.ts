import { GameState, ResultReason, ResultState } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
export function createPlayGames() {
  const opening = createGame('play-opening', 'Opening with captures', ['e2e4', 'd7d5', 'e4d5', 'd8d5']);
  const mate = createGame('play-mate', 'One move to checkmate', ['f2f3', 'e7e5', 'g2g4']);
  const drawn = createGame('play-drawn', 'Draw by agreement', [], { state: GameState.AnalysisWhiteMove });
  drawn.resultState = ResultState.Drawn;
  drawn.resultReason = ResultReason.DrawAgreement;
  const resigned = createGame('play-resigned', 'White resigned', [], { state: GameState.AnalysisWhiteMove });
  resigned.resultState = ResultState.BlackWon;
  resigned.resultReason = ResultReason.Resignation;
  return [opening, mate, drawn, resigned];
}
