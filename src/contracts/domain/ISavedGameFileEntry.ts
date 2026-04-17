export interface ISavedGameFileEntry {
  gameId: string;
  saveName: string;
  filePath: string;
  savedAtUtc?: string;
  isAutosave: boolean;
}
