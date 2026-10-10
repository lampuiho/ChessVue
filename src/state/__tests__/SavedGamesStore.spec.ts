import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveGameTargetKind, type IGame } from '@/contracts';
import type { ISavedGameGroup } from '@/contracts/domain';

import {
  createGame,
  createSavedGameEntry,
  createSavedGameGroup,
  createSettingsSnapshot,
  randomDelay,
  rejectWithRandomDelay,
  resolveWithRandomDelay,
} from './StateStoreTestUtility';
import { RecordTimestamp } from '@/utility/date';

let useSavedGamesStore: typeof import('..').useSavedGamesStore;
let settingsSnapshot = createSettingsSnapshot();
let saveGroups: ISavedGameGroup[] = [];
let storedGamesByPath = new Map<string, IGame>();
let appCloseHandler: (() => Promise<void> | void) | undefined;
const unsubscribeMock = vi.fn();
const domain = {
  SavedGameIndexService: {
    projectSaveGroups: vi.fn((_rootPath: string) => structuredClone(saveGroups)),
    getLatestSaveEntry: vi.fn((entries) => structuredClone(entries[entries.length - 1])),
    getLatestSaveEntryForGame: vi.fn((groups, gameId: string) => structuredClone(groups.find((group: ISavedGameGroup) => group.gameId === gameId)?.saves.slice(-1)[0])),
    getAutosaveFilePath: vi.fn((rootPath: string, gameId: string) => `${rootPath}/${gameId}/auto.json`),
    getNamedSaveFilePath: vi.fn((rootPath: string, gameId: string, saveName: string) => `${rootPath}/${gameId}/${saveName}.json`),
  },
  PlatformEventService: {
    subscribeToAppCloseRequested: vi.fn((_owner: string, onCloseRequested: () => Promise<void> | void) => {
      appCloseHandler = onCloseRequested;
      return () => {
        appCloseHandler = undefined;
        unsubscribeMock();
      };
    }),
  },
  SerializationService: {
    listManagedSaveEntries: vi.fn(() => resolveWithRandomDelay(new Map())),
    readGameDocument: vi.fn(async (filePath: string) => {
      const game = storedGamesByPath.get(filePath);
      if (!game) throw new Error(`Missing test game document: ${filePath}.`);
      return resolveWithRandomDelay(game);
    }),
    writeGameDocument: vi.fn(async (filePath: string, game: IGame) => {
      storedGamesByPath.set(filePath, structuredClone(game));
      await randomDelay();
    }),
    deleteDocument: vi.fn(async (_filePath: string) => resolveWithRandomDelay(undefined)),
    selectExportFile: vi.fn((suggestedPath?: string) => resolveWithRandomDelay(`exports/${suggestedPath}`)),
    selectImportFile: vi.fn(async () => resolveWithRandomDelay('imports/game-a.json')),
  },
  UserSettingService: {
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
  },
};

describe('useSavedGamesStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    settingsSnapshot = createSettingsSnapshot();
    saveGroups = [
      createSavedGameGroup('game-a', [
        createSavedGameEntry('game-a', 'auto', '2026-04-17T10:00:00.000Z', true, 'saves/game-a/auto.json'),
        createSavedGameEntry('game-a', 'manual', '2026-04-17T11:00:00.000Z', false, 'saves/game-a/manual.json'),
      ]),
    ];
    storedGamesByPath = new Map([
      ['saves/game-a/auto.json', createGame({ metadata: { id: 'game-a', name: 'Autosave', createdAt: new RecordTimestamp('2026-04-17T09:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T10:00:00.000Z') } })],
      ['saves/game-a/manual.json', createGame({ metadata: { id: 'game-a', name: 'Manual', createdAt: new RecordTimestamp('2026-04-17T09:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T11:00:00.000Z') } })],
      ['imports/game-a.json', createGame({ metadata: { id: 'imported-game', name: 'Imported', createdAt: new RecordTimestamp('2026-04-17T08:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T08:30:00.000Z') } })],
    ]);
    appCloseHandler = undefined;
    unsubscribeMock.mockClear();
    domain.SavedGameIndexService.projectSaveGroups.mockClear();
    domain.SavedGameIndexService.getLatestSaveEntry.mockClear();
    domain.SavedGameIndexService.getLatestSaveEntryForGame.mockClear();
    domain.SavedGameIndexService.getAutosaveFilePath.mockClear();
    domain.SavedGameIndexService.getNamedSaveFilePath.mockClear();
    domain.PlatformEventService.subscribeToAppCloseRequested.mockClear();
    domain.SerializationService.listManagedSaveEntries.mockClear();
    domain.SerializationService.readGameDocument.mockClear();
    domain.SerializationService.writeGameDocument.mockClear();
    domain.SerializationService.deleteDocument.mockClear();
    domain.SerializationService.selectExportFile.mockClear();
    domain.SerializationService.selectImportFile.mockClear();
    domain.UserSettingService.getSettingsOrDefault.mockClear();
    vi.doMock('@/domain', () => domain);
    ({ useSavedGamesStore } = await import('..'));
  });

  it('lists saved games, restores latest saves, and loads selected documents', async () => {
    const store = useSavedGamesStore();
    const game = createGame({ metadata: { id: 'game-a', name: 'Current', createdAt: new RecordTimestamp('2026-04-17T12:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T12:00:00.000Z') } });

    expect(await store.listSavedGames()).toEqual(saveGroups);
    expect(await store.restoreGames(['game-a'])).toMatchObject([
      { gameId: 'game-a', status: 'restored', game: { metadata: { name: 'Manual' } } },
    ]);
    expect((await store.loadGame('game-a', 'manual')).metadata.name).toBe('Manual');
    expect((await store.loadRecentGame('game-a')).metadata.name).toBe('Manual');
    expect(await store.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName: 'manual' })).toBe('saves/game-a/manual.json');
    await store.deleteSave('game-a', 'manual');
    expect(await store.exportGame(game)).toBe('exports/game-a.json');
    const imported = await store.importGame();
    expect(imported?.metadata.id).not.toBe('imported-game');
    expect(imported?.metadata.name).toBe('Imported');
    expect(domain.SerializationService.deleteDocument).toHaveBeenCalledWith('saves/game-a/manual.json');
    expect(domain.SerializationService.writeGameDocument).toHaveBeenCalledWith('saves/game-a/manual.json', game, true);
    expect(domain.SerializationService.writeGameDocument).toHaveBeenCalledWith('exports/game-a.json', game, true);
  });

  it('returns undefined when import selection fails', async () => {
    domain.SerializationService.selectImportFile.mockImplementationOnce(async () => rejectWithRandomDelay(new Error('dialog failed')));
    const store = useSavedGamesStore();

    await expect(store.importGame()).resolves.toBeUndefined();
  });
  it('isolates missing and corrupt games while restoring every valid target', async () => {
    saveGroups.push(
      createSavedGameGroup('game-b', [createSavedGameEntry('game-b', 'auto', '2026-04-17T10:00:00.000Z', true, 'saves/game-b/auto.json')]),
      createSavedGameGroup('game-c', [createSavedGameEntry('game-c', 'auto', '2026-04-17T10:00:00.000Z', true, 'saves/game-c/auto.json')]),
    );
    storedGamesByPath.set('saves/game-c/auto.json', createGame({ metadata: { id: 'game-c', name: 'Game C', createdAt: new RecordTimestamp('2026-04-17T09:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T10:00:00.000Z') } }));
    const corruptError = new Error('Invalid saved game document.');
    domain.SerializationService.readGameDocument.mockImplementation(async (filePath: string) => {
      if (filePath === 'saves/game-b/auto.json') throw corruptError;
      const game = storedGamesByPath.get(filePath);
      if (!game) throw new Error(`Missing test game document: ${filePath}.`);
      return resolveWithRandomDelay(game);
    });
    const store = useSavedGamesStore();

    const outcomes = await store.restoreGames(['game-a', 'missing-game', 'game-b', 'game-c']);

    expect(outcomes[0]).toMatchObject({ gameId: 'game-a', status: 'restored', game: { metadata: { name: 'Manual' } } });
    expect(outcomes[1]).toMatchObject({ gameId: 'missing-game', status: 'failed', error: { message: 'Saved game entry not found for missing-game.' } });
    expect(outcomes[2]).toEqual({ gameId: 'game-b', status: 'failed', error: corruptError });
    expect(outcomes[3]).toMatchObject({ gameId: 'game-c', status: 'restored', game: { metadata: { name: 'Game C' } } });
    expect(domain.SerializationService.readGameDocument).toHaveBeenCalledTimes(3);
  });
  it('registers and disposes close autosave subscriptions through the persistence boundary', async () => {
    const store = useSavedGamesStore();
    const gameA = createGame({ metadata: { id: 'game-a', name: 'Game A', createdAt: new RecordTimestamp('2026-04-17T12:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T12:00:00.000Z') } });
    const gameB = createGame({ metadata: { id: 'game-b', name: 'Game B', createdAt: new RecordTimestamp('2026-04-17T12:00:00.000Z'), updatedAt: new RecordTimestamp('2026-04-17T12:00:00.000Z') } });

    await store.registerAutosaveOnClose(() => [gameA, gameB]);
    expect(domain.PlatformEventService.subscribeToAppCloseRequested).toHaveBeenCalledTimes(1);

    await appCloseHandler?.();

    expect(domain.SerializationService.writeGameDocument).toHaveBeenCalledWith('saves/game-a/auto.json', gameA, true);
    expect(domain.SerializationService.writeGameDocument).toHaveBeenCalledWith('saves/game-b/auto.json', gameB, true);

    store.disposeAutosaveOnClose();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
