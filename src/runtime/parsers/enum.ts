import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

/**
 * Enum parser factory: restricts the state to a fixed set of values.
 *
 * `enumParser(['draft', 'published'] as const)` → `Parser<'draft' | 'published'>`
 * — the union is preserved for type inference, and anything outside the set is
 * unparseable (fall back to the default + dev warn).
 *
 * Matching is by string representation, so string and number enums both work:
 * `?status=draft` → `'draft'`, `?level=2` → `2`.
 */
export function enumParser<T extends string | number>(values: readonly T[]): Parser<T> {
  return {
    parse(raw: RawQueryValue): T | null {
      const value = singleValue(raw)
      if (value === null) {
        return null
      }
      for (const candidate of values) {
        if (String(candidate) === value) {
          return candidate
        }
      }
      return null
    },
    serialize(value: T): string | null {
      if (!values.includes(value)) {
        return null
      }
      return String(value)
    },
  }
}
