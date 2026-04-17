import { defineStore } from 'pinia';

import type { ISavedGameGroup } from '@/contracts/domain';
import { SavedGameIndexService, SerializationService, UserSettingService } from '@/domain';

async function getSaveRootPath(): Promise<string> {
  return (await UserSettingService.getSettingsOrDefault()).gameSession.saveRootPath;
}
async function _listManagedSaveGroups(rootPath: string): Promise<ISavedGameGroup[]> {
  return SavedGameIndexService.projectSaveGroups(rootPath, await SerializationService.listManagedSaveEntries(rootPath));
}
function getTargetEntry(groups: ISavedGameGroup[], gameId: string, saveName?: string) {
  const group = groups.find((candidate) => candidate.gameId === gameId);
  if (!group) throw new Error(`Saved game group not found for ${gameId}.`);
  const targetEntry = saveName
    ? group.saves.find((candidate) => candidate.saveName === saveName)
    : SavedGameIndexService.getLatestSaveEntry(group.saves);
  if (!targetEntry) throw new Error(`Saved game entry not found for ${gameId}${saveName ? `/${saveName}` : ''}.`);
  return targetEntry;
}

export const useSavedGamesStore = defineStore('savedGamesStore', () => {
  async function listSavedGames(): Promise<ISavedGameGroup[]> {
    return _listManagedSaveGroups(await getSaveRootPath());
  }
  async function getRestoreFilePaths(gameIds: string[]): Promise<string[]> {
    const groups = await listSavedGames();
    return gameIds.map((gameId) => {
      const targetEntry = SavedGameIndexService.getLatestSaveEntryForGame(groups, gameId);
      if (!targetEntry) throw new Error(`Saved game entry not found for ${gameId}.`);
      return targetEntry.filePath;
    });
  }
  async function getLoadFilePath(gameId: string, saveName?: string): Promise<string> {
    return getTargetEntry(await listSavedGames(), gameId, saveName).filePath;
  }
  async function getRecentGamePath(gameId: string): Promise<string> {
    const targetEntry = SavedGameIndexService.getLatestSaveEntryForGame(await listSavedGames(), gameId);
    if (!targetEntry) throw new Error(`Saved game entry not found for ${gameId}.`);
    return targetEntry.filePath;
  }
  async function deleteSave(gameId: string, saveName?: string): Promise<void> {
    await SerializationService.deleteDocument(getTargetEntry(await listSavedGames(), gameId, saveName).filePath);
  }
  async function exportGame(gameId: string): Promise<string> {
    return SerializationService.selectExportFile(`${gameId}.json`);
  }
  async function importGame(): Promise<string | undefined> {
    try {
      return await SerializationService.selectImportFile(await getSaveRootPath());
    } catch (error) {
      console.error('[SavedGamesStore] Import file selection failed.', error);
      return;
    }
  }

  return { listSavedGames, getRestoreFilePaths, getLoadFilePath, getRecentGamePath, deleteSave, exportGame, importGame };
});
