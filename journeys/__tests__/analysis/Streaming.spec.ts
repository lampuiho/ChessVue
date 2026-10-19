import { describe, expect, it, vi } from 'vitest';
import type { IEngineAnalysisUpdate, IGame } from '@/contracts';
import { boot } from '../support/UiHarness';
function expectIndependentUpdates(game: IGame, callbacks: ((update: IEngineAnalysisUpdate) => void)[], update: IEngineAnalysisUpdate) {
  const neighbour = JSON.stringify(game.analysis.seats[1]!.lines);
  callbacks[0]!({ ...update, lines: update.lines.map((line) => ({ ...line, depth: 19 })) });
  expect(game.analysis.seats[0]!.lines[0]!.depth).toBe(19);
  expect(JSON.stringify(game.analysis.seats[1]!.lines)).toBe(neighbour);
  callbacks[1]!({ ...update, lines: update.lines.map((line) => ({ ...line, depth: 8 })) });
  expect(game.analysis.seats[1]!.lines[0]!.depth).toBe(8);
  expect(game.analysis.seats[0]!.lines[0]!.depth).toBe(19);
}
describe('JRN-ANALYSIS-01/12 obsolete subscriptions', () => {
  it('ignores delivered callbacks after navigation removal and board edit', async () => {
    const { games, domain, fixtures } = await boot('analysis');
    const game = games.getGame('analysis-free') as unknown as IGame;
    await games.refreshAnalysis(game);
    await vi.waitFor(() => expect(game.analysis.seats[0]!.lines).toHaveLength(3));
    const callbacks: ((update: IEngineAnalysisUpdate) => void)[] = [];
    const subscribe = domain.EngineRuntimeService.subscribeToAnalysis;
    vi.spyOn(domain.EngineRuntimeService, 'subscribeToAnalysis').mockImplementation((engine, callback) => {
      callbacks.push(callback);
      return subscribe(engine, callback);
    });
    await games.refreshAnalysis(game);
    await vi.waitFor(() => expect(game.analysis.seats[0]!.lines).toHaveLength(3));
    const seat = game.analysis.seats[0]!;
    const update: IEngineAnalysisUpdate = { position: fixtures.getPosition(game, game.renderedPath), lines: seat.lines, bestMove: seat.bestMove, isFinal: false };
    const oldCallback = callbacks[0]!;
    expectIndependentUpdates(game, callbacks, update);
    await games.navigateToNode(game, game.moveTree.root.children[0]!);
    const selected = JSON.stringify(game.analysis);
    oldCallback(update);
    expect(JSON.stringify(game.analysis)).toBe(selected);
    expect(game.renderedPath).toEqual([0]);
    const removedCallback = callbacks[2]!;
    await games.removeAnalysisEngine(game, 0);
    const removed = JSON.stringify(game.analysis);
    removedCallback(update);
    expect(JSON.stringify(game.analysis)).toBe(removed);
    await games.enterBoardEdit(game);
    const edited = JSON.stringify(game.analysis);
    callbacks.at(-1)!(update);
    expect(JSON.stringify(game.analysis)).toBe(edited);
  });
});
