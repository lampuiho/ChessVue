import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISavedGameGroup } from '@/contracts/domain';

import {
  createSavedGameEntry,
  createSavedGameGroup,
  createSettingsSnapshot,
  rejectWithRandomDelay,
  resolveWithRandomDelay,
} from './StateStoreTestUtility';

let useSavedGamesStore: typeof import('..').useSavedGamesStore;
let settingsSnapshot = createSettingsSnapshot();
let saveGroups: ISavedGameGroup[] = [];
const domain = {
  SavedGameIndexService: {
    projectSaveGroups: vi.fn((_rootPath: string) => structuredClone(saveGroups)),
    getLatestSaveEntry: vi.fn((entries) => structuredClone(entries[entries.length - 1])),
  },
  SerializationService: {
    listManagedSaveEntries: vi.fn(() => resolveWithRandomDelay(new Map())),
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
    domain.SavedGameIndexService.projectSaveGroups.mockClear();
    domain.SavedGameIndexService.getLatestSaveEntry.mockClear();
    domain.SerializationService.listManagedSaveEntries.mockClear();
    domain.SerializationService.selectExportFile.mockClear();
    domain.SerializationService.selectImportFile.mockClear();
    domain.UserSettingService.getSettingsOrDefault.mockClear();
    vi.doMock('@/domain', () => domain);
    ({ useSavedGamesStore } = await import('..'));
  });

  it('lists saved games and resolves load paths from projected save groups', async () => {
    const store = useSavedGamesStore();

    expect(await store.listSavedGames()).toEqual(saveGroups);
    expect(await store.getLoadFilePath('game-a', 'manual')).toBe('saves/game-a/manual.json');
    expect(await store.getRecentGamePath('game-a')).toBe('saves/game-a/manual.json');
    expect(await store.exportGame('game-a')).toBe('exports/game-a.json');
    expect(await store.importGame()).toBe('imports/game-a.json');
  });

  it('returns undefined when import selection fails', async () => {
    domain.SerializationService.selectImportFile.mockImplementationOnce(async () => rejectWithRandomDelay(new Error('dialog failed')));
    const store = useSavedGamesStore();

    await expect(store.importGame()).resolves.toBeUndefined();
  });
});
