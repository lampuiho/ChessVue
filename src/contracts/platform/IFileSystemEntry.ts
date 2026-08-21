import { SaveTimestamp } from '@/utility/date';

export interface IFileSystemEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  lastModifiedUtc?: SaveTimestamp;
}
