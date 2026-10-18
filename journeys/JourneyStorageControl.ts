import type { BrowserFileSystem } from '@/platform/browser/BrowserFileSystem';
// Simulate an external change to an existing managed file, never an in-memory game.
export function changeManagedFile(files: BrowserFileSystem, path: string, raw: string | null): void {
  if (!files.listFiles().includes(path) || !/^saves\/[^/]+\/[^/]+\.json$/.test(path)) throw new Error('Choose an existing managed save path.');
  if (raw === null) files.deleteFile(path);
  else files.writeTextFile(path, raw, { overwrite: true });
}
