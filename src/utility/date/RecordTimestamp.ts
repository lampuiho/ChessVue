import { UtcTimestamp } from './UtcTimestamp';

/** When a saved-game record was created or last touched. */
export class RecordTimestamp extends UtcTimestamp {
  toString(): string {
    return this.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
