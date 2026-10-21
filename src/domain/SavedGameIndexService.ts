import type { ISavedGameFileEntry, ISavedGameGroup } from '@/contracts/domain';
import type { IFileSystemEntry } from '@/contracts/platform';

function _normalisePath(targetPath: string): string {
  const normalisedPath = targetPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (normalisedPath.length > 1 && normalisedPath.endsWith('/')) return normalisedPath.slice(0, -1);
  return normalisedPath;
}
function _joinPath(...segments: string[]): string {
  return _normalisePath(segments.filter((segment) => segment.length > 0).join('/'));
}
function _getSaveName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.json') ? fileName.slice(0, -5) : fileName;
}
function _isJsonFile(entry: IFileSystemEntry): boolean {
  return !entry.isDirectory && entry.name.toLowerCase().endsWith('.json');
}
function _isSafeSegment(value: string): boolean {
  return !!value.trim() && !/[\\/:*?"<>|\x00-\x1f]/.test(value) && !/[. ]$/.test(value)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}
function _assertSafeSegment(value: string) {
  if (!_isSafeSegment(value)) throw new Error('Managed save identity and name must be single file-name segments.');
}
function _compareSaveEntries(left: ISavedGameFileEntry, right: ISavedGameFileEntry): number {
  const leftTime = left.savedAtUtc?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightTime = right.savedAtUtc?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return rightTime - leftTime;
  if (left.isAutosave !== right.isAutosave) return left.isAutosave ? -1 : 1;
  return left.saveName.localeCompare(right.saveName);
}

export const SavedGameIndexService = {
  normaliseSaveRootPath(configuredRootPath: string): string {
    return _normalisePath(configuredRootPath);
  },
  getGameFolderPath(rootPath: string, gameId: string): string {
    _assertSafeSegment(gameId);
    return _joinPath(this.normaliseSaveRootPath(rootPath), gameId);
  },
  getAutosaveFilePath(rootPath: string, gameId: string): string {
    return _joinPath(this.getGameFolderPath(rootPath, gameId), 'auto.json');
  },
  getNamedSaveFilePath(rootPath: string, gameId: string, saveName: string): string {
    _assertSafeSegment(saveName);
    if (saveName.toLowerCase() === 'auto') throw new Error('The name auto is reserved for automatic saves.');
    return _joinPath(this.getGameFolderPath(rootPath, gameId), `${saveName}.json`);
  },
  projectSaveGroups(rootPath: string, entriesByDirectory: ReadonlyMap<string, IFileSystemEntry[]>): ISavedGameGroup[] {
    const normalisedRootPath = this.normaliseSaveRootPath(rootPath);
    const rootEntries = entriesByDirectory.get(normalisedRootPath) ?? [];
    return rootEntries.filter((entry) => entry.isDirectory && _isSafeSegment(entry.name) && _normalisePath(entry.path) === _joinPath(normalisedRootPath, entry.name)).map((entry) => {
      const gameFolderPath = _normalisePath(entry.path);
      const saves = (entriesByDirectory.get(gameFolderPath) ?? [])
        .filter((candidate) => _isJsonFile(candidate) && _isSafeSegment(candidate.name) && _normalisePath(candidate.path) === _joinPath(gameFolderPath, candidate.name))
        .map((candidate) => {
          const saveName = _getSaveName(candidate.name);
          return {
            gameId: entry.name,
            saveName,
            filePath: _normalisePath(candidate.path),
            savedAtUtc: candidate.lastModifiedUtc,
            isAutosave: saveName === 'auto',
          } satisfies ISavedGameFileEntry;
        })
        .sort(_compareSaveEntries);
      return { gameId: entry.name, gameFolderPath, saves } satisfies ISavedGameGroup;
    }).filter((group) => group.saves.length > 0).sort((left, right) => left.gameId.localeCompare(right.gameId));
  },
  getLatestSaveEntry(entries: ISavedGameFileEntry[]): ISavedGameFileEntry | undefined {
    if (entries.length === 0) return;
    return [...entries].sort(_compareSaveEntries)[0];
  },
  getLatestSaveEntryForGame(groups: readonly ISavedGameGroup[], gameId: string): ISavedGameFileEntry | undefined {
    const group = groups.find((candidate) => candidate.gameId === gameId);
    if (!group) return;
    return this.getLatestSaveEntry(group.saves);
  },
};
