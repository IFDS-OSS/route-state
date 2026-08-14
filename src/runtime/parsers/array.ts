import type { Parser, RawQueryValue } from './types'

/**
 * Array parser factory using **repeated params** (locked spec): `?tags=a&tags=b`.
 *
 * - A single string is treated as a 1-element array (`?tags=a` → `['a']`).
 * - Per locked spec §13.2, any item failing the item parser invalidates the
 *   *whole* array → the core falls back to the default and logs a dev warning.
 * - On serialize, items that cannot be represented are dropped; an empty result
 *   removes the param from the URL.
 */
export function arrayParser<T>(itemParser: Parser<T>): Parser<T[]> {
  return {
    isArrayParser: true,
    parse(raw: RawQueryValue): T[] | null {
      const items = Array.isArray(raw) ? raw : raw === null ? [] : [raw]
      const result: T[] = []
      for (const item of items) {
        const parsed = itemParser.parse(item === null ? null : item)
        if (parsed === null) {
          return null
        }
        result.push(parsed)
      }
      return result
    },
    serialize(value: T[]): string[] | null {
      const result: string[] = []
      for (const item of value) {
        const serialized = itemParser.serialize(item)
        // Nested arrays / non-serializable items are dropped (v1 limitation)
        if (serialized === null || Array.isArray(serialized)) {
          continue
        }
        result.push(serialized)
      }
      return result.length > 0 ? result : null
    },
  }
}
