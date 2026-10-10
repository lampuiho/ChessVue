import { AnalysisTimestamp } from '@/utility/date';
import { createGame, createWorkspace, engineProfiles, fixtureTimestamp, getPosition } from '../FixtureFactory';
import { createVariations } from '../ScriptedEngine';
export function create() {
  const free = createGame('analysis-free', 'Free analysis with two engines', ['e2e4', 'e7e5'], { freeAnalysis: true });
  const scoreOnly = createGame('analysis-score-only', 'Live score-only analysis', ['e2e4', 'e7e5']);
  const moves = createGame('analysis-live-moves', 'Live analysis moves enabled', ['e2e4', 'e7e5']);
  moves.gameplayOptions.showLiveAnalysisMoves = true;
  for (const game of [free, scoreOnly, moves]) {
    const variations = createVariations(getPosition(game, game.renderedPath));
    game.analysis.seats = engineProfiles.slice(0, 2).map((engine) => ({
      assignedEngine: structuredClone(engine), updatedAt: new AnalysisTimestamp(fixtureTimestamp), bestMove: variations[0]?.[0], isComplete: false,
      lines: variations.map((pv, index) => ({ depth: 12, scoreCp: 24 - index * 18, pv })),
    }));
  }
  return createWorkspace([free, scoreOnly, moves]);
}
