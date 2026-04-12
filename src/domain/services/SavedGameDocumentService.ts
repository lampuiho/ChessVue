import { PlatformErrorKind, type IPlatformError } from '@/contracts';
import { usePlatformService, type IFileSystemEntry } from '@/platform';

function isPlatformError(error: unknown): error is IPlatformError {
  return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}

export const SavedGameDocumentService = {
  async listManagedSaveEntries(rootPath: string): Promise<ReadonlyMap<string, IFileSystemEntry[]>> {
    const storageAdapter = usePlatformService().getStorageAdapter();
    try {
      const entriesByDirectory = new Map<string, IFileSystemEntry[]>();
      const rootEntries = await storageAdapter.listDirectory(rootPath);
      entriesByDirectory.set(rootPath, rootEntries);
      for (const entry of rootEntries) {
        if (!entry.isDirectory) continue;
        entriesByDirectory.set(entry.path, await storageAdapter.listDirectory(entry.path));
      }
      return entriesByDirectory;
    } catch (error) {
      if (isPlatformError(error) && error.kind === PlatformErrorKind.NotFound) return new Map();
      throw error;
    }
  },
  async readDocument(filePath: string): Promise<string> {
    return usePlatformService().getStorageAdapter().readTextFile(filePath);
  },
  async writeDocument(filePath: string, raw: string, overwrite: boolean = false): Promise<void> {
    await usePlatformService().getStorageAdapter().writeTextFile(filePath, raw, overwrite);
  },
  async deleteDocument(filePath: string): Promise<void> {
    await usePlatformService().getStorageAdapter().deleteFile(filePath);
  },
  async selectImportFile(startDirectory?: string): Promise<string> {
    return usePlatformService().getStorageAdapter().showOpenDialog(startDirectory);
  },
  async selectExportFile(suggestedPath?: string): Promise<string> {
    return usePlatformService().getStorageAdapter().showSaveDialog(suggestedPath);
  },
};
