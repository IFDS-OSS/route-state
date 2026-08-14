import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

const FLOAT_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Float/number parser: `?price=3.14` or `?price=1e3`.
 * `NaN`/`±Infinity` are never representable in a URL and serialize to `null`
 * (the param is removed).
 */
export const floatParser: Parser<number> = {
  parse(raw: RawQueryValue): number | null {
    const value = singleValue(raw)
    if (value === null || !FLOAT_RE.test(value)) {
      return null
    }
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  },
  serialize(value: number): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null
    }
    return String(value)
  },
}
