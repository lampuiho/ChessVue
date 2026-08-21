import { UtcTimestamp } from './UtcTimestamp';

/** When a platform event subscription was registered. Debug-only; never rendered. */
export class RegistrationTimestamp extends UtcTimestamp {
  toString(): string {
    return this.toISOString();
  }
}
