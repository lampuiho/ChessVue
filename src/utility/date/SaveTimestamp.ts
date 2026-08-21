import { UtcTimestamp } from './UtcTimestamp';

/** When a game was last saved to disk (autosave, save file, or file-system modification time). Rendered on HomeView's recent-games list. */
export class SaveTimestamp extends UtcTimestamp {
  toString(): string {
    return this.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
