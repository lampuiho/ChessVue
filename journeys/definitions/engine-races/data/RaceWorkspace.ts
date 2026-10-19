import { DrawOfferDirection, PlayerColour, PlayerType, TimeControlPreset, type IEnginePlayer, type IGame } from '@/contracts';
import { AnalysisTimestamp } from '@/utility/date';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { setPausedClock } from '../../../builders/ClockFixtureBuilder';
import { createEngineProfiles } from '../../../data/EngineProfile';
export function createRaceGames(now: number, variant?: string): IGame[] {
  if (variant && variant !== 'incoming-draw') throw new Error('Unknown engine-races variant.');
  const profiles = createEngineProfiles().slice(0, 2);
  const live = createGame('race-live', 'Held player reply', ['e2e4'], {
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 2000 },
  });
  const black: IEnginePlayer = { colour: PlayerColour.Black, type: PlayerType.Engine, displayName: 'Journey A', assignedEngine: { ...profiles[0]!, options: { ...profiles[0]!.options } } };
  live.blackPlayer = black;
  live.gameplayOptions.showLiveAnalysisMoves = true;
  setPausedClock(live, 60000, now);
  if (variant === 'incoming-draw') live.drawOfferState = { offeringColour: PlayerColour.Black, respondingColour: PlayerColour.White, direction: DrawOfferDirection.Incoming };
  const analysis = createGame('race-analysis', 'Held analysis searches', ['e2e4', 'e7e5'], { freeAnalysis: true });
  const independent = createGame('race-independent', 'Independent analysis game', ['d2d4', 'd7d5'], { freeAnalysis: true });
  for (const game of [analysis, independent]) game.analysis.seats = profiles.map((profile) => ({
    assignedEngine: { ...profile, options: { ...profile.options } }, updatedAt: new AnalysisTimestamp(now), lines: [], isComplete: false,
  }));
  return [live, analysis, independent];
}
