export * from './types'

import { stringParser } from './string'
import { integerParser } from './integer'
import { floatParser } from './float'
import { booleanParser } from './boolean'
import { dateParser } from './date'
import { jsonParser } from './json'
import { arrayParser } from './array'
import { zodParser } from './zod'
import { enumParser } from './enum'
import { slugParser } from './slug'

export {
  stringParser,
  integerParser,
  floatParser,
  booleanParser,
  dateParser,
  jsonParser,
  arrayParser,
  zodParser,
  enumParser,
  slugParser,
}

/**
 * Shorthand registry for `{ type: 'number' }` / `{ parser: 'integer' }` options.
 * `number` and `float` are aliases for the float parser.
 */
export const parserRegistry = {
  string: stringParser,
  number: floatParser,
  float: floatParser,
  integer: integerParser,
  boolean: booleanParser,
  date: dateParser,
  json: jsonParser,
  slug: slugParser,
} as const

export type ParserKey = keyof typeof parserRegistry

/** State value type produced by each shorthand parser key. */
export interface ParserTypeByKey {
  string: string
  number: number
  float: number
  integer: number
  boolean: boolean
  date: Date
  json: unknown
  slug: string
}
