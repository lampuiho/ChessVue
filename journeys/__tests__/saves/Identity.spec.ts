import { describe, expect, it } from 'vitest';
import { SaveGameTargetKind } from '@/contracts';
import { boot } from '../support/UiHarness';
describe('UI-08 managed and imported game identity', () => {
  it.each(['selected', 'latest', 'recent'])('uses the enumerated group identity for a %s load and its next save', async (selection) => {
    const { api, games, stores, domain } = await boot('saves');
    const source = (await import('../../builders/GameFixtureBuilder')).createGame('save-other', 'Mismatched document identity', ['c2c4']);
    const { $: _runtime, ...rootPosition } = source.rootPosition;
    await domain.SerializationService.writeGameDocument('saves/follow-up-managed/Chosen.json', source, true);
    const recent = await stores.useRecentGameStore().getRecentGames();
    expect(recent.some((entry) => entry.gameId === 'follow-up-managed')).toBe(true);
    const saved = stores.useSavedGamesStore();
    const game = selection === 'recent' ? await saved.loadRecentGame('follow-up-managed')
      : await saved.loadGame('follow-up-managed', selection === 'selected' ? 'Chosen' : undefined);
    const otherSave = api.readFile('saves/save-other/auto.json');
    const inserted = await games.insertGame(game);
    const target = await saved.saveGame(inserted, { targetKind: SaveGameTargetKind.Autosave, overwrite: true });
    expect.soft(inserted.metadata.id).toBe('follow-up-managed');
    expect.soft(target).toBe('saves/follow-up-managed/auto.json');
    expect.soft(api.readFile('saves/save-other/auto.json')).toBe(otherSave);
    expect(inserted.metadata.name).toBe(source.metadata.name);
    expect(inserted.rootPosition).toMatchObject(rootPosition);
  });
  it('allocates a fresh import identity before workspace insertion even without a collision', async () => {
    const { api, games, stores } = await boot('saves');
    api.chooseImport('imports/valid.json');
    const game = await stores.useSavedGamesStore().importGame();
    expect(game).toBeDefined();
    expect(games.getGame('import-external')).toBeUndefined();
    expect(game!.metadata.id).not.toBe('import-external');
    expect(game!.metadata.name).toBe('External imported game');
  });
  it('already repairs a colliding identity when inserting another workspace', async () => {
    const { games, stores } = await boot('saves');
    const existing = games.getGame('save-library');
    const loaded = await stores.useSavedGamesStore().loadGame('save-library', 'Opening');
    const inserted = await games.insertGame(loaded);
    expect(inserted.metadata.id).not.toBe('save-library');
    expect(games.getGame('save-library')).toBe(existing);
    expect(games.getGame(inserted.metadata.id)).toBe(inserted);
    const ids = games.listGames().map((game) => game.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
