import { TimeControlPreset } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { setPausedClock } from '../../../builders/ClockFixtureBuilder';
export function createClockGames(now: number) {
  const increment = createGame('clocks-increment', 'Two-minute clock + 2 seconds', ['e2e4', 'e7e5'], {
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 120000, incrementMs: 2000 },
  });
  setPausedClock(increment, 120000, now);
  const timeouts = ['a', 'b'].map((suffix) => {
    const game = createGame(`clocks-timeout-${suffix}`, `Timeout ${suffix.toUpperCase()}`, [], {
      timeControl: { preset: TimeControlPreset.Bullet, initialMs: 3000, incrementMs: 0 },
    });
    setPausedClock(game, 3000, now);
    return game;
  });
  return [increment, ...timeouts];
}
