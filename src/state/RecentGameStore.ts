import { defineStore } from 'pinia';

import { RecentGameSourceKind, type IRecentGameEntry } from '@/contracts';
import { SavedGameIndexService, UserSettingService } from '@/domain';
import { listManagedSaveGroups, readGameDocument } from '@/utility/state';

function compareRecentEntries(left: IRecentGameEntry, right: IRecentGameEntry): number {
  return Date.parse(right.lastSavedAtUtc) - Date.parse(left.lastSavedAtUtc);
}

export const useRecentGameStore = defineStore('recentGameStore', () => {
  async function getRecentGames(): Promise<IRecentGameEntry[]> {
    const settings = await UserSettingService.getSettingsOrDefault();
    const groups = await listManagedSaveGroups(settings.gameSession.saveRootPath);
    const latestEntries = groups.map((group) => SavedGameIndexService.getLatestSaveEntry(group.saves)).filter((entry) => !!entry);
    const recentEntriesById = new Map<string, IRecentGameEntry>();
    for (const latestEntry of latestEntries) {
      try {
        const game = await readGameDocument(latestEntry.filePath);
        const projectedEntry: IRecentGameEntry = {
          gameId: game.metadata.id,
          displayName: game.metadata.name,
          sourceKind: latestEntry.isAutosave ? RecentGameSourceKind.Autosave : RecentGameSourceKind.SaveFile,
          filePath: latestEntry.isAutosave ? undefined : latestEntry.filePath,
          lastSavedAtUtc: latestEntry.savedAtUtc ?? game.metadata.updatedAt,
        };
        const existingEntry = recentEntriesById.get(projectedEntry.gameId);
        if (!existingEntry || compareRecentEntries(projectedEntry, existingEntry) < 0) recentEntriesById.set(projectedEntry.gameId, projectedEntry);
      } catch (error) {
        console.error(`[RecentGameStore] Failed to project recent entry from ${latestEntry.filePath}.`, error);
      }
    }
    return [...recentEntriesById.values()].sort(compareRecentEntries);
  }

  return { getRecentGames };
});
