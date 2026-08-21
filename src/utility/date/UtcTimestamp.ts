/** Base for all persisted UTC instant types. Serialises to an ISO 8601 string; each subclass owns its own display format via toString. */
export abstract class UtcTimestamp extends Date {
  toJSON(): string {
    return this.toISOString();
  }
}
