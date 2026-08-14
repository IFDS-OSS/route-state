import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  arrayParser,
  booleanParser,
  dateParser,
  enumParser,
  floatParser,
  integerParser,
  jsonParser,
  slugParser,
  stringParser,
  zodParser,
} from '../src/runtime/parsers'

describe('stringParser', () => {
  it('parses raw strings', () => {
    expect(stringParser.parse('hello')).toBe('hello')
    expect(stringParser.parse(null)).toBeNull()
    expect(stringParser.parse(['a', 'b'])).toBe('a') // first value for scalar
  })

  it('serializes strings, omitting empty strings', () => {
    expect(stringParser.serialize('hello')).toBe('hello')
    expect(stringParser.serialize('')).toBeNull()
    expect(stringParser.serialize(42 as unknown as string)).toBeNull()
  })
})

describe('integerParser', () => {
  it('parses integers strictly', () => {
    expect(integerParser.parse('42')).toBe(42)
    expect(integerParser.parse('-7')).toBe(-7)
    expect(integerParser.parse('+3')).toBe(3)
    expect(integerParser.parse('4.2')).toBeNull()
    expect(integerParser.parse('abc')).toBeNull()
    expect(integerParser.parse('')).toBeNull()
    expect(integerParser.parse(null)).toBeNull()
  })

  it('rejects unsafe integers', () => {
    expect(integerParser.parse('99999999999999999999')).toBeNull()
  })

  it('serializes integers only', () => {
    expect(integerParser.serialize(7)).toBe('7')
    expect(integerParser.serialize(-3)).toBe('-3')
    expect(integerParser.serialize(7.5)).toBeNull()
    expect(integerParser.serialize(NaN)).toBeNull()
    expect(integerParser.serialize(Infinity)).toBeNull()
  })
})

describe('floatParser', () => {
  it('parses floats strictly', () => {
    expect(floatParser.parse('3.14')).toBe(3.14)
    expect(floatParser.parse('-0.5')).toBe(-0.5)
    expect(floatParser.parse('1e3')).toBe(1000)
    expect(floatParser.parse('.5')).toBe(0.5)
    expect(floatParser.parse('abc')).toBeNull()
    expect(floatParser.parse('1.2.3')).toBeNull()
  })

  it('rejects non-finite results', () => {
    expect(floatParser.parse('1e999')).toBeNull() // becomes Infinity
  })

  it('serializes finite numbers only', () => {
    expect(floatParser.serialize(2.5)).toBe('2.5')
    expect(floatParser.serialize(-0.5)).toBe('-0.5')
    expect(floatParser.serialize(NaN)).toBeNull()
    expect(floatParser.serialize(Infinity)).toBeNull()
    expect(floatParser.serialize(-Infinity)).toBeNull()
  })
})

describe('booleanParser', () => {
  it('parses true/false/1/0 strictly', () => {
    expect(booleanParser.parse('true')).toBe(true)
    expect(booleanParser.parse('1')).toBe(true)
    expect(booleanParser.parse('false')).toBe(false)
    expect(booleanParser.parse('0')).toBe(false)
    expect(booleanParser.parse('garbage')).toBeNull()
    expect(booleanParser.parse('yes')).toBeNull()
  })

  it('serializes as true/false strings', () => {
    expect(booleanParser.serialize(true)).toBe('true')
    expect(booleanParser.serialize(false)).toBe('false')
  })
})

describe('dateParser', () => {
  const iso = '2026-08-14T00:00:00.000Z'

  it('parses ISO dates', () => {
    const d = dateParser.parse(iso)
    expect(d).toBeInstanceOf(Date)
    expect((d as Date).toISOString()).toBe(iso)
  })

  it('rejects invalid dates', () => {
    expect(dateParser.parse('not-a-date')).toBeNull()
    expect(dateParser.parse('')).toBeNull()
  })

  it('serializes valid dates to ISO-8601 UTC', () => {
    expect(dateParser.serialize(new Date(iso))).toBe(iso)
    expect(dateParser.serialize(new Date('invalid'))).toBeNull()
    expect(dateParser.serialize('2026' as unknown as Date)).toBeNull()
  })
})

describe('arrayParser', () => {
  it('parses repeated params into arrays', () => {
    expect(arrayParser(stringParser).parse(['a', 'b'])).toEqual(['a', 'b'])
    expect(arrayParser(stringParser).parse('a')).toEqual(['a'])
  })

  it('invalidates the whole array when any item fails', () => {
    const nums = arrayParser(integerParser)
    expect(nums.parse(['1', 'abc'])).toBeNull()
    expect(nums.parse(['1', '2'])).toEqual([1, 2])
  })

  it('serializes to repeated params, dropping unrepresentable items', () => {
    expect(arrayParser(stringParser).serialize(['a', 'b'])).toEqual(['a', 'b'])
    expect(arrayParser(stringParser).serialize(['a', ''])).toEqual(['a'])
    expect(arrayParser(stringParser).serialize([])).toBeNull()
    expect(arrayParser(floatParser).serialize([1, NaN])).toEqual(['1'])
  })
})

describe('jsonParser', () => {
  it('parses JSON strings', () => {
    expect(jsonParser.parse('{"a":1}')).toEqual({ a: 1 })
    expect(jsonParser.parse('[1,2]')).toEqual([1, 2])
    expect(jsonParser.parse('null')).toBeNull() // invalid: null signals unparseable
  })

  it('rejects malformed JSON', () => {
    expect(jsonParser.parse('{"a":')).toBeNull()
    expect(jsonParser.parse('not json')).toBeNull()
    expect(jsonParser.parse(['a', 'b'])).toBeNull() // JSON is a single param
  })

  it('serializes objects, rejecting circular structures', () => {
    expect(jsonParser.serialize({ a: 1 })).toBe('{"a":1}')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(jsonParser.serialize(circular)).toBeNull()
    expect(jsonParser.serialize(undefined)).toBeNull()
  })
})

describe('enumParser', () => {
  const status = enumParser(['draft', 'published', 'archived'] as const)

  it('parses only allowed values', () => {
    expect(status.parse('draft')).toBe('draft')
    expect(status.parse('published')).toBe('published')
    expect(status.parse('archived')).toBe('archived')
    expect(status.parse('unknown')).toBeNull()
    expect(status.parse('DRAFT')).toBeNull()
    expect(status.parse('')).toBeNull()
    expect(status.parse(null)).toBeNull()
  })

  it('supports number enums via string representation', () => {
    const level = enumParser([1, 2, 3] as const)
    expect(level.parse('2')).toBe(2)
    expect(level.parse('4')).toBeNull()
    expect(level.serialize(2)).toBe('2')
  })

  it('serializes only allowed values', () => {
    expect(status.serialize('draft')).toBe('draft')
    expect(status.serialize('archived')).toBe('archived')
    expect(status.serialize('deleted' as never)).toBeNull()
  })
})

describe('slugParser', () => {
  it('parses valid slugs', () => {
    expect(slugParser.parse('getting-started')).toBe('getting-started')
    expect(slugParser.parse('a')).toBe('a')
    expect(slugParser.parse('a1-b2-c3')).toBe('a1-b2-c3')
  })

  it('rejects malformed slugs', () => {
    expect(slugParser.parse('Getting-Started')).toBeNull()
    expect(slugParser.parse('-leading')).toBeNull()
    expect(slugParser.parse('trailing-')).toBeNull()
    expect(slugParser.parse('double--dash')).toBeNull()
    expect(slugParser.parse('has space')).toBeNull()
    expect(slugParser.parse('under_score')).toBeNull()
    expect(slugParser.parse('')).toBeNull()
    expect(slugParser.parse(null)).toBeNull()
  })

  it('serializes valid slugs only', () => {
    expect(slugParser.serialize('hello-world')).toBe('hello-world')
    expect(slugParser.serialize('Hello')).toBeNull()
    expect(slugParser.serialize('with space')).toBeNull()
    expect(slugParser.serialize(42 as unknown as string)).toBeNull()
  })
})

describe('zodParser', () => {
  it('parses through safeParse and rejects invalid input', () => {
    const parser = zodParser(z.string().min(2))
    expect(parser.parse('ab')).toBe('ab')
    expect(parser.parse('a')).toBeNull()
  })

  it('applies transforms on parse', () => {
    const parser = zodParser(z.coerce.number())
    expect(parser.parse('42')).toBe(42)
    expect(parser.parse('abc')).toBeNull()
  })

  it('parses JSON objects from encoded strings', () => {
    const parser = zodParser(z.object({ name: z.string() }))
    expect(parser.parse('{"name":"bob"}')).toEqual({ name: 'bob' })
    expect(parser.parse('{"name":1}')).toBeNull()
  })

  it('serializes by output runtime type', () => {
    expect(zodParser(z.string()).serialize('hi')).toBe('hi')
    expect(zodParser(z.number()).serialize(3.5)).toBe('3.5')
    expect(zodParser(z.boolean()).serialize(false)).toBe('false')
    expect(zodParser(z.object({ a: z.number() })).serialize({ a: 1 })).toBe('{"a":1}')
    expect(zodParser(z.string()).serialize(null as unknown as string)).toBeNull()
  })
})

describe('round-trips', () => {
  it('parse(serialize(x)) === x for every built-in parser', () => {
    expect(stringParser.parse(stringParser.serialize('hi')!)).toBe('hi')
    expect(integerParser.parse(integerParser.serialize(42)!)).toBe(42)
    expect(floatParser.parse(floatParser.serialize(-0.5)!)).toBe(-0.5)
    expect(booleanParser.parse(booleanParser.serialize(true)!)).toBe(true)
    expect(booleanParser.parse(booleanParser.serialize(false)!)).toBe(false)
    const iso = '2026-01-01T00:00:00.000Z'
    expect(dateParser.parse(dateParser.serialize(new Date(iso))!)!.toISOString()).toBe(iso)
    expect(jsonParser.parse(jsonParser.serialize({ a: [1, 2], b: 'x' })!)).toEqual({ a: [1, 2], b: 'x' })
    expect(arrayParser(integerParser).parse(arrayParser(integerParser).serialize([1, 2, 3])!)).toEqual([1, 2, 3])
    const status = enumParser(['draft', 'published'] as const)
    expect(status.parse(status.serialize('draft')!)).toBe('draft')
    expect(slugParser.parse(slugParser.serialize('hello-world')!)).toBe('hello-world')
  })
})
