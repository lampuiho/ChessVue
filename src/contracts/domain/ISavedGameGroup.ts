import type { ISavedGameFileEntry } from './ISavedGameFileEntry';

export interface ISavedGameGroup {
  gameId: string;
  gameFolderPath: string;
  saves: ISavedGameFileEntry[];
}
