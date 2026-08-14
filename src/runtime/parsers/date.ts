import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

/**
 * Date parser: `?from=2026-08-14T00:00:00.000Z` (ISO-8601, UTC via `toISOString`).
 * Invalid dates (on read or write) are treated as unparseable.
 */
export const dateParser: Parser<Date> = {
  parse(raw: RawQueryValue): Date | null {
    const value = singleValue(raw)
    if (value === null) {
      return null
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  },
  serialize(value: Date): string | null {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return null
    }
    return value.toISOString()
  },
}
