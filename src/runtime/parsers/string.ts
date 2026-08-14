import type { Parser, RawQueryValue } from './types'
import { singleValue } from './types'

/**
 * Default parser. Passes strings through untouched.
 *
 * Per the locked spec, an empty string is treated as *absent*: reading `?q=`
 * falls back to the default, and writing `''` removes the param from the URL.
 */
export const stringParser: Parser<string> = {
  parse(raw: RawQueryValue): string | null {
    return singleValue(raw)
  },
  serialize(value: string): string | null {
    if (typeof value !== 'string' || value === '') {
      return null
    }
    return value
  },
}
