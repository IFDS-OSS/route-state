import type { Parser, RawQueryValue } from './types'

/**
 * JSON parser (locked spec §2): the whole object lives in a single
 * JSON-encoded param, e.g. `?filter=%7B%22a%22%3A1%7D` (`{"a":1}`).
 *
 * Malformed JSON on read, and circular structures on write, are treated as
 * unparseable (fall back to default / remove param + dev warn).
 */
export const jsonParser: Parser<unknown> = {
  parse(raw: RawQueryValue): unknown | null {
    if (Array.isArray(raw) || raw === null) {
      return null
    }
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  serialize(value: unknown): string | null {
    try {
      const serialized = JSON.stringify(value)
      return typeof serialized === 'string' ? serialized : null
    } catch {
      return null
    }
  },
}
