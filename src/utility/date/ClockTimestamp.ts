import { UtcTimestamp } from './UtcTimestamp';

/** Internal clock bookkeeping instant (clock start/pause/last-move). Not shown to players directly; drift-safe elapsed time is computed from it. */
export class ClockTimestamp extends UtcTimestamp {
  toString(): string {
    return this.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
