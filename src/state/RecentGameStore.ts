import { defineStore } from 'pinia';

import type { ISavedGameGroup } from '@/contracts/domain';
import { RecentGameSourceKind, type IRecentGameEntry } from '@/contracts';
import { SavedGameIndexService, SerializationService, UserSettingService } from '@/domain';
import { SaveTimestamp } from '@/utility/date';

function _compareRecentEntries(left: IRecentGameEntry, right: IRecentGameEntry): number {
  return right.lastSavedAtUtc.getTime() - left.lastSavedAtUtc.getTime();
}
async function _listManagedSaveGroups(rootPath: string): Promise<ISavedGameGroup[]> {
  return SavedGameIndexService.projectSaveGroups(rootPath, await SerializationService.listManagedSaveEntries(rootPath));
}

export const useRecentGameStore = defineStore('recentGameStore', () => {
  async function getRecentGames(): Promise<IRecentGameEntry[]> {
    const settings = await UserSettingService.getSettingsOrDefault();
    const groups = await _listManagedSaveGroups(settings.gameSession.saveRootPath);
    const latestEntries = groups.map((group) => SavedGameIndexService.getLatestSaveEntry(group.saves)).filter((entry) => !!entry);
    const recentEntriesById = new Map<string, IRecentGameEntry>();
    for (const latestEntry of latestEntries) {
      try {
        const game = await SerializationService.readGameDocument(latestEntry.filePath);
        const projectedEntry: IRecentGameEntry = {
          gameId: latestEntry.gameId,
          displayName: game.metadata.name,
          sourceKind: latestEntry.isAutosave ? RecentGameSourceKind.Autosave : RecentGameSourceKind.SaveFile,
          filePath: latestEntry.isAutosave ? undefined : latestEntry.filePath,
          lastSavedAtUtc: latestEntry.savedAtUtc ?? new SaveTimestamp(game.metadata.updatedAt),
        };
        const existingEntry = recentEntriesById.get(projectedEntry.gameId);
        if (!existingEntry || _compareRecentEntries(projectedEntry, existingEntry) < 0) recentEntriesById.set(projectedEntry.gameId, projectedEntry);
      } catch (error) {
        console.error(`[RecentGameStore] Failed to project recent entry from ${latestEntry.filePath}.`, error);
      }
    }
    return [...recentEntriesById.values()].sort(_compareRecentEntries);
  }

  return { getRecentGames };
});
