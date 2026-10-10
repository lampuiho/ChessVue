import { describe, expect, it } from 'vitest';

import type { IFileSystemEntry } from '@/contracts/platform';

import { SavedGameIndexService } from '..';
import { SaveTimestamp } from '@/utility/date';

function createEntry(path: string, isDirectory: boolean, lastModifiedUtc?: string): IFileSystemEntry {
  const segments = path.replace(/\\/g, '/').split('/');
  return {
    path,
    name: segments[segments.length - 1]!,
    isDirectory,
    lastModifiedUtc: lastModifiedUtc === undefined ? undefined : new SaveTimestamp(lastModifiedUtc),
  };
}

describe('SavedGameIndexService', () => {
  it.each(['../other', 'a/b', 'a\\b', 'C:other', '.', '..', 'NUL', 'name.'])('rejects an unsafe managed identity %s', (identity) => {
    expect(() => SavedGameIndexService.getAutosaveFilePath('saves', identity)).toThrow();
    expect(() => SavedGameIndexService.getNamedSaveFilePath('saves', 'game', identity)).toThrow();
  });
  it('excludes enumerated entries outside their managed parent', () => {
    const escaped = { ...createEntry('elsewhere/game', true), name: 'game' };
    const entries = new Map<string, IFileSystemEntry[]>([
      ['saves', [escaped, createEntry('saves/valid', true)]],
      ['saves/valid', [{ ...createEntry('elsewhere/auto.json', false), name: 'auto.json' }]],
    ]);
    expect(SavedGameIndexService.projectSaveGroups('saves', entries)).toEqual([]);
  });
  it('normalises save paths and builds file locations per game', () => {
    expect(SavedGameIndexService.normaliseSaveRootPath('saves\\\\')).toBe('saves');
    expect(SavedGameIndexService.getGameFolderPath('saves\\\\', 'game-1')).toBe('saves/game-1');
    expect(SavedGameIndexService.getAutosaveFilePath('saves', 'game-1')).toBe('saves/game-1/auto.json');
    expect(SavedGameIndexService.getNamedSaveFilePath('saves', 'game-1', 'manual')).toBe('saves/game-1/manual.json');
  });

  it('projects saved game groups and sorts save files by recency and autosave priority', () => {
    const entriesByDirectory = new Map<string, IFileSystemEntry[]>([
      ['saves', [
        createEntry('saves/game-b', true),
        createEntry('saves/game-a', true),
        createEntry('saves/readme.txt', false),
      ]],
      ['saves/game-a', [
        createEntry('saves/game-a/manual.json', false, '2026-04-17T11:00:00.000Z'),
        createEntry('saves/game-a/auto.json', false, '2026-04-17T11:00:00.000Z'),
        createEntry('saves/game-a/notes.txt', false, '2026-04-17T10:00:00.000Z'),
      ]],
      ['saves/game-b', [
        createEntry('saves/game-b/archive.json', false, '2026-04-17T09:00:00.000Z'),
      ]],
    ]);

    const groups = SavedGameIndexService.projectSaveGroups('saves\\\\', entriesByDirectory);

    expect(groups.map((group) => group.gameId)).toEqual(['game-a', 'game-b']);
    expect(groups[0]!.saves.map((save) => save.saveName)).toEqual(['auto', 'manual']);
    expect(groups[0]!.saves[0]!.filePath).toBe('saves/game-a/auto.json');
    expect(SavedGameIndexService.getLatestSaveEntry(groups[0]!.saves)?.saveName).toBe('auto');
    expect(SavedGameIndexService.getLatestSaveEntryForGame(groups, 'game-a')?.saveName).toBe('auto');
  });
});
