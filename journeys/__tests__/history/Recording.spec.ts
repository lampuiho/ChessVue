import { describe, expect, it, vi } from 'vitest';
import type { IGame } from '@/contracts';
import { boot, legalMove } from '../support/UiHarness';

describe('JRN-HIST-06 actual-move recording', () => {
  it('copies both engines without runtime data and keeps records independent of later evaluation and exploration', async () => {
    const context = await boot('analysis');
    const { games, domain } = context;
    const game = games.getGame('analysis-live-moves') as unknown as IGame;
    await games.refreshAnalysis(game);
    await vi.waitFor(() => expect(game.analysis.seats.every((seat) => seat.lines.length === 3)).toBe(true));
    const expected = game.analysis.seats.map((seat) => ({ name: seat.assignedEngine.displayName, lines: JSON.stringify(seat.lines, (key, value) => key === '$' ? undefined : value) }));
    await games.makeMove(game, legalMove(context, game, 'g1f3'));
    const node = game.moveTree.root.children[0]!.children[0]!.children[0]!;
    const record = node.recordedAnalysis!;
    expect(record.seats).toHaveLength(2);
    record.seats.forEach((seat, index) => {
      expect(seat).not.toBe(game.analysis.seats[index]);
      expect(seat.assignedEngine.displayName).toBe(expected[index]!.name);
      expect(JSON.parse(JSON.stringify(seat.lines))).toEqual(JSON.parse(expected[index]!.lines));
    });
    const raw = JSON.stringify(record);
    expect(raw).not.toContain('"$"');
    await games.enterInGameAnalysis(game);
    await games.makeMove(game, legalMove(context, game, 'b8c6'));
    expect(node.children[0]!.recordedAnalysis).toBeUndefined();
    expect(JSON.stringify(record)).toBe(raw);
    games.exitInGameAnalysis(game);
    await games.makeMove(game, legalMove(context, game, 'g8f6'));
    expect(node.children).toHaveLength(1);
    const restored = domain.SerializationService.deserialiseGame(domain.SerializationService.serialiseGame(game));
    expect(JSON.stringify(restored.moveTree.root.children[0]!.children[0]!.children[0]!.recordedAnalysis)).toBe(raw);
  });
  it('does not invent recorded output when no engine has analysed the played position', async () => {
    const context = await boot('history');
    const game = context.games.getGame('history-allowed') as unknown as IGame;
    await context.games.makeMove(game, legalMove(context, game, 'd2d4'));
    let node = game.moveTree.root;
    for (const index of game.livePath!) node = node.children[index]!;
    expect(node.recordedAnalysis).toBeUndefined();
  });
});
