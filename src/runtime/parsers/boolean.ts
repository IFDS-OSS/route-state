import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

/**
 * Boolean parser with presence/absence semantics (locked spec §13.4):
 * - absent param → the configured default (core handles this)
 * - `'true'`/`'1'` → `true`
 * - `'false'`/`'0'` → `false`
 * - anything else → invalid (fall back to default + dev warn)
 *
 * `true` serializes to `'true'` (`?feature=true`) since vue-router cannot emit
 * a valueless `?feature`.
 */
export const booleanParser: Parser<boolean> = {
  parse(raw: RawQueryValue): boolean | null {
    const value = singleValue(raw)
    if (value === 'true' || value === '1') {
      return true
    }
    if (value === 'false' || value === '0') {
      return false
    }
    return null
  },
  serialize(value: boolean): string {
    return value ? 'true' : 'false'
  },
}
