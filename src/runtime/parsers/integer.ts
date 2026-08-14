import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

const INTEGER_RE = /^[+-]?\d+$/

/** Strict integer parser: `?page=42`. Non-safe integers are treated as invalid. */
export const integerParser: Parser<number> = {
  parse(raw: RawQueryValue): number | null {
    const value = singleValue(raw)
    if (value === null || !INTEGER_RE.test(value)) {
      return null
    }
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  },
  serialize(value: number): string | null {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      !Number.isSafeInteger(value)
    ) {
      return null
    }
    return String(value)
  },
}
