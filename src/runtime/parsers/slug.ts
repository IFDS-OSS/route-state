import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

/**
 * Slug parser: lowercase alphanumeric words joined by single hyphens, e.g.
 * `?section=getting-started`. No leading/trailing/consecutive hyphens, no
 * spaces or symbols. Validation is strict — uppercase or otherwise malformed
 * input is rejected (not silently normalized) so it falls back to the default
 * + dev warn, keeping `parse(serialize(x)) === x` a real invariant.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugParser: Parser<string> = {
  parse(raw: RawQueryValue): string | null {
    const value = singleValue(raw)
    if (value === null || !SLUG_RE.test(value)) {
      return null
    }
    return value
  },
  serialize(value: string): string | null {
    if (typeof value !== 'string' || !SLUG_RE.test(value)) {
      return null
    }
    return value
  },
}
