import { defineStore } from 'pinia';

import type { IGame } from '@/contracts';
import type { ISavedGameGroup } from '@/contracts/domain';
import { SaveGameTargetKind, type ISaveGameOptions } from '@/contracts/state';
import { PlatformEventService, SavedGameIndexService, SerializationService, UserSettingService } from '@/domain';

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
function getTargetPath(rootPath: string, game: IGame, options: ISaveGameOptions): string {
  switch (options.targetKind) {
    case SaveGameTargetKind.Autosave: return SavedGameIndexService.getAutosaveFilePath(rootPath, game.metadata.id);
    case SaveGameTargetKind.ManagedSave: return SavedGameIndexService.getNamedSaveFilePath(rootPath, game.metadata.id, options.saveName!);
    case SaveGameTargetKind.ExternalFile: return options.filePath!;
  }
}

export const useSavedGamesStore = defineStore('savedGamesStore', () => {
  let _appCloseUnsubscribe: (() => void) | undefined;

  async function listSavedGames(): Promise<ISavedGameGroup[]> {
    return _listManagedSaveGroups(await getSaveRootPath());
  }
  async function restoreGames(gameIds: string[]): Promise<IGame[]> {
    if (gameIds.length === 0) return [];
    const groups = await listSavedGames();
    const loadedGames: IGame[] = [];
    for (const gameId of gameIds) {
      const targetEntry = SavedGameIndexService.getLatestSaveEntryForGame(groups, gameId);
      if (!targetEntry) throw new Error(`Saved game entry not found for ${gameId}.`);
      loadedGames.push(await SerializationService.readGameDocument(targetEntry.filePath));
    }
    return loadedGames;
  }
  async function loadGame(gameId: string, saveName?: string): Promise<IGame> {
    return SerializationService.readGameDocument(getTargetEntry(await listSavedGames(), gameId, saveName).filePath);
  }
  async function loadRecentGame(gameId: string): Promise<IGame> {
    const targetEntry = SavedGameIndexService.getLatestSaveEntryForGame(await listSavedGames(), gameId);
    if (!targetEntry) throw new Error(`Saved game entry not found for ${gameId}.`);
    return SerializationService.readGameDocument(targetEntry.filePath);
  }
  async function saveGame(game: IGame, options: ISaveGameOptions): Promise<string> {
    const rootPath = await getSaveRootPath();
    const targetPath = getTargetPath(rootPath, game, options);
    await SerializationService.writeGameDocument(targetPath, game, options.overwrite ?? options.targetKind !== SaveGameTargetKind.Autosave);
    return targetPath;
  }
  async function registerAutosaveOnClose(getGames: () => readonly IGame[]): Promise<void> {
    disposeAutosaveOnClose();
    _appCloseUnsubscribe = PlatformEventService.subscribeToAppCloseRequested('SavedGamesStore', async () => {
      const settings = await UserSettingService.getSettingsOrDefault();
      if (!settings.gameSession.autosaveOnClose) return;
      for (const game of getGames()) await saveGame(game, { targetKind: SaveGameTargetKind.Autosave });
    }, 'autosave-on-close');
  }
  function disposeAutosaveOnClose(): void {
    _appCloseUnsubscribe?.();
    _appCloseUnsubscribe = undefined;
  }
  async function deleteSave(gameId: string, saveName?: string): Promise<void> {
    await SerializationService.deleteDocument(getTargetEntry(await listSavedGames(), gameId, saveName).filePath);
  }
  async function exportGame(game: IGame): Promise<string> {
    const filePath = await SerializationService.selectExportFile(`${game.metadata.id}.json`);
    await saveGame(game, { targetKind: SaveGameTargetKind.ExternalFile, filePath, overwrite: true });
    return filePath;
  }
  async function importGame(): Promise<IGame | undefined> {
    let filePath: string;
    try {
      filePath = await SerializationService.selectImportFile(await getSaveRootPath());
    } catch {
      return;
    }
    return SerializationService.readGameDocument(filePath);
  }

  return { listSavedGames, restoreGames, loadGame, loadRecentGame, saveGame, registerAutosaveOnClose, disposeAutosaveOnClose, deleteSave, exportGame, importGame };
});
