import type { IFileSystemEntry } from '@/platform';

export interface ISavedGameFileEntry {
  gameId: string;
  saveName: string;
  filePath: string;
  savedAtUtc: string | null;
  isAutosave: boolean;
}
export interface ISavedGameGroup {
  gameId: string;
  gameFolderPath: string;
  saves: ISavedGameFileEntry[];
}

function normalisePath(targetPath: string): string {
  const normalisedPath = targetPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (normalisedPath.length > 1 && normalisedPath.endsWith('/')) return normalisedPath.slice(0, -1);
  return normalisedPath;
}
function joinPath(...segments: string[]): string {
  return normalisePath(segments.filter((segment) => segment.length > 0).join('/'));
}
function getSaveName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.json') ? fileName.slice(0, -5) : fileName;
}
function isJsonFile(entry: IFileSystemEntry): boolean {
  return !entry.isDirectory && entry.name.toLowerCase().endsWith('.json');
}
function compareSaveEntries(left: ISavedGameFileEntry, right: ISavedGameFileEntry): number {
  const leftTime = left.savedAtUtc === null ? Number.NEGATIVE_INFINITY : Date.parse(left.savedAtUtc);
  const rightTime = right.savedAtUtc === null ? Number.NEGATIVE_INFINITY : Date.parse(right.savedAtUtc);
  if (leftTime !== rightTime) return rightTime - leftTime;
  if (left.isAutosave !== right.isAutosave) return left.isAutosave ? -1 : 1;
  return left.saveName.localeCompare(right.saveName);
}

export const SavedGameIndexService = {
  normaliseSaveRootPath(configuredRootPath: string): string {
    return normalisePath(configuredRootPath);
  },
  getGameFolderPath(rootPath: string, gameId: string): string {
    return joinPath(this.normaliseSaveRootPath(rootPath), gameId);
  },
  getAutosaveFilePath(rootPath: string, gameId: string): string {
    return joinPath(this.getGameFolderPath(rootPath, gameId), 'auto.json');
  },
  getNamedSaveFilePath(rootPath: string, gameId: string, saveName: string): string {
    return joinPath(this.getGameFolderPath(rootPath, gameId), `${saveName}.json`);
  },
  projectSaveGroups(rootPath: string, entriesByDirectory: ReadonlyMap<string, IFileSystemEntry[]>): ISavedGameGroup[] {
    const normalisedRootPath = this.normaliseSaveRootPath(rootPath);
    const rootEntries = entriesByDirectory.get(normalisedRootPath) ?? [];
    return rootEntries.filter((entry) => entry.isDirectory).map((entry) => {
      const gameFolderPath = normalisePath(entry.path);
      const saves = (entriesByDirectory.get(gameFolderPath) ?? [])
        .filter((candidate) => isJsonFile(candidate))
        .map((candidate) => {
          const saveName = getSaveName(candidate.name);
          return {
            gameId: entry.name,
            saveName,
            filePath: normalisePath(candidate.path),
            savedAtUtc: candidate.lastModifiedUtc,
            isAutosave: saveName === 'auto',
          } satisfies ISavedGameFileEntry;
        })
        .sort(compareSaveEntries);
      return { gameId: entry.name, gameFolderPath, saves } satisfies ISavedGameGroup;
    }).filter((group) => group.saves.length > 0).sort((left, right) => left.gameId.localeCompare(right.gameId));
  },
  getLatestSaveEntry(entries: ISavedGameFileEntry[]): ISavedGameFileEntry | null {
    if (entries.length === 0) return null;
    return [...entries].sort(compareSaveEntries)[0] ?? null;
  },
};
