import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentGameSourceKind } from '@/contracts';
import type { ISavedGameGroup } from '@/contracts/domain';

import {
  createGame,
  createSavedGameEntry,
  createSavedGameGroup,
  createSettingsSnapshot,
  rejectWithRandomDelay,
  resolveWithRandomDelay,
} from './StateStoreTestUtility';

let useRecentGameStore: typeof import('..').useRecentGameStore;
let settingsSnapshot = createSettingsSnapshot();
let saveGroups: ISavedGameGroup[] = [];
let gamesByPath = new Map<string, ReturnType<typeof createGame>>();
const domain = {
  SavedGameIndexService: {
    projectSaveGroups: vi.fn((_rootPath: string) => structuredClone(saveGroups)),
    getLatestSaveEntry: vi.fn((entries) => structuredClone(entries[entries.length - 1])),
  },
  SerializationService: {
    listManagedSaveEntries: vi.fn(() => resolveWithRandomDelay(new Map())),
    readGameDocument: vi.fn(async (filePath: string) => {
      const game = gamesByPath.get(filePath);
      if (!game) throw new Error(`Unknown test game: ${filePath}.`);
      return resolveWithRandomDelay(game);
    }),
  },
  UserSettingService: {
    getSettingsOrDefault: vi.fn(() => resolveWithRandomDelay(settingsSnapshot)),
  },
};

describe('useRecentGameStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    settingsSnapshot = createSettingsSnapshot();
    saveGroups = [
      createSavedGameGroup('game-a', [
        createSavedGameEntry('game-a', 'manual', '2026-04-17T11:00:00.000Z', false, 'saves/game-a/manual.json'),
      ]),
      createSavedGameGroup('game-b', [
        createSavedGameEntry('game-b', 'auto', '2026-04-17T12:00:00.000Z', true, 'saves/game-b/auto.json'),
      ]),
    ];
    gamesByPath = new Map([
      ['saves/game-a/manual.json', createGame({ metadata: { id: 'game-a', name: 'Alpha', createdAt: '2026-04-17T10:00:00.000Z', updatedAt: '2026-04-17T11:00:00.000Z' } })],
      ['saves/game-b/auto.json', createGame({ metadata: { id: 'game-b', name: 'Beta', createdAt: '2026-04-17T10:00:00.000Z', updatedAt: '2026-04-17T12:00:00.000Z' } })],
    ]);
    domain.SavedGameIndexService.projectSaveGroups.mockClear();
    domain.SavedGameIndexService.getLatestSaveEntry.mockClear();
    domain.SerializationService.listManagedSaveEntries.mockClear();
    domain.SerializationService.readGameDocument.mockClear();
    domain.UserSettingService.getSettingsOrDefault.mockClear();
    vi.doMock('@/domain', () => domain);
    ({ useRecentGameStore } = await import('..'));
  });

  it('projects, deduplicates, and sorts recent games from the latest saved entries', async () => {
    const store = useRecentGameStore();
    const recentGames = await store.getRecentGames();

    expect(recentGames).toHaveLength(2);
    expect(recentGames[0]).toMatchObject({
      gameId: 'game-b',
      displayName: 'Beta',
      sourceKind: RecentGameSourceKind.Autosave,
      filePath: undefined,
    });
    expect(recentGames[1]).toMatchObject({
      gameId: 'game-a',
      displayName: 'Alpha',
      sourceKind: RecentGameSourceKind.SaveFile,
      filePath: 'saves/game-a/manual.json',
    });
  });

  it('skips unreadable saved files while keeping valid entries', async () => {
    domain.SerializationService.readGameDocument.mockImplementationOnce(async () => rejectWithRandomDelay(new Error('broken save')));
    const store = useRecentGameStore();

    await expect(store.getRecentGames()).resolves.toEqual([
      expect.objectContaining({ gameId: 'game-b', displayName: 'Beta' }),
    ]);
  });
});
