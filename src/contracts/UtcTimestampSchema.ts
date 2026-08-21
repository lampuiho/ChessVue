import { z } from 'zod'
import type { UtcTimestamp } from '@/utility/date'

/**
 * Accepts either a persisted ISO 8601 string (on read) or an already-hydrated Date/UtcTimestamp instance
 * (on write, since serialise* re-validates the in-memory IGame before JSON.stringify), and always
 * produces the target UtcTimestamp subclass so the schema is safe to reuse for both directions.
 */
export function utcTimestampSchema<T extends UtcTimestamp>(construct: (value: string | Date) => T) {
  return z.union([z.string().datetime({ offset: true }), z.instanceof(Date)]).transform(construct)
}
