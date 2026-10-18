import { describe, expect, it, vi } from 'vitest';
import { createTimedContext, legalMove } from '../support/UiHarness';
describe('UI-07 move-count autosave', () => {
  it('writes each configured interval and overwrites the previous autosave', async () => {
    const context = await createTimedContext();
    const { games, game, stores, api } = context;
    const settings = stores.useSettingsStore();
    settings.draftSettings!.gameSession.autosaveAfterMoveCount = 2;
    await settings.applySettings();
    const path = 'saves/' + game.metadata.id + '/auto.json';
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    expect(api.readFile(path)).toBeUndefined();
    await games.makeMove(game, legalMove(context, game, 'e7e5'));
    await vi.waitFor(() => expect(JSON.parse(api.readFile(path)!).renderedPath).toHaveLength(2));
    await games.makeMove(game, legalMove(context, game, 'g1f3'));
    await games.makeMove(game, legalMove(context, game, 'b8c6'));
    await vi.waitFor(() => expect(JSON.parse(api.readFile(path)!).renderedPath).toHaveLength(4));
    expect(games.autosaveError).toBe('');
  });
});
