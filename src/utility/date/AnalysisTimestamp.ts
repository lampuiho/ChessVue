import { UtcTimestamp } from './UtcTimestamp';

/** When an engine analysis snapshot was last updated. */
export class AnalysisTimestamp extends UtcTimestamp {
  toString(): string {
    return this.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
