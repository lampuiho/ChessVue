import { describe, expect, it, vi } from 'vitest';
import type { IGame } from '@/contracts';
import { boot } from '../support/UiHarness';
describe('JRN-ANALYSIS-08 assignment invariants', () => {
  it('rejects duplicate and fifth profiles without mutating assignments or another game', async () => {
    const { games, stores, domain } = await boot('analysis');
    const game = games.getGame('analysis-free') as unknown as IGame;
    const other = games.getGame('analysis-live-moves') as unknown as IGame;
    await games.refreshAnalysis(other);
    await vi.waitFor(() => expect(other.analysis.seats[1]!.lines[0]?.scoreCp).toBe(36));
    const otherBefore = domain.SerializationService.serialiseGame(other);
    const profile = stores.useEnginesStore().listConfiguredEngines()[0]!;
    const before = game.analysis.seats.map((seat) => seat.assignedEngine);
    await expect(games.addAnalysisEngine(game, profile)).rejects.toThrow('already assigned');
    expect(game.analysis.seats.map((seat) => seat.assignedEngine)).toEqual(before);
    for (const name of ['C', 'D']) await games.addAnalysisEngine(game, { ...profile, id: name, displayName: 'Journey ' + name });
    const full = JSON.stringify(game.analysis);
    await expect(games.addAnalysisEngine(game, { ...profile, id: 'E', displayName: 'Journey E' })).rejects.toThrow('more than four');
    expect(JSON.stringify(game.analysis)).toBe(full);
    expect(domain.SerializationService.serialiseGame(other)).toBe(otherBefore);
    expect(game.analysis.seats[2]!.assignedEngine.options).not.toBe(profile.options);
  });
});
