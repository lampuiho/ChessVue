import { SaveTimestamp } from '@/utility/date';

export interface ISavedGameFileEntry {
  gameId: string;
  saveName: string;
  filePath: string;
  savedAtUtc?: SaveTimestamp;
  isAutosave: boolean;
}
