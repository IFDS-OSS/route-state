import { describe, expectTypeOf, it } from 'vitest'
import type { Ref } from 'vue'
import { z } from 'zod'
import { createRouteState, createRouteStates } from '../src/runtime/core'
import { arrayParser, enumParser, integerParser, slugParser } from '../src/runtime/parsers'

const useRouteState = createRouteState({ router: {} as never })
const useRouteStates = createRouteStates({ router: {} as never })

describe('useRouteState type inference', () => {
  it('no options → string', () => {
    expectTypeOf(useRouteState('name')).toEqualTypeOf<Ref<string>>()
  })

  it('shorthand parser keys', () => {
    expectTypeOf(useRouteState('page', { type: 'integer' })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useRouteState('page', { type: 'number' })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useRouteState('page', { type: 'float' })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useRouteState('flag', { type: 'boolean' })).toEqualTypeOf<Ref<boolean>>()
    expectTypeOf(useRouteState('from', { type: 'date' })).toEqualTypeOf<Ref<Date>>()
    expectTypeOf(useRouteState('raw', { type: 'json' })).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useRouteState('page', { parser: 'integer' })).toEqualTypeOf<Ref<number>>()
  })

  it('custom parser objects', () => {
    expectTypeOf(useRouteState('n', { parser: integerParser })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(
      useRouteState('tags', { parser: arrayParser(integerParser), default: [] }),
    ).toEqualTypeOf<Ref<number[]>>()
    expectTypeOf(
      useRouteState('status', { parser: enumParser(['draft', 'published'] as const) }),
    ).toEqualTypeOf<Ref<'draft' | 'published'>>()
  })

  it('enum factory and slug shorthand', () => {
    expectTypeOf(useRouteState('status', { parser: enumParser(['a', 'b'] as const) })).toEqualTypeOf<Ref<'a' | 'b'>>()
    expectTypeOf(useRouteState('slug', { type: 'slug' })).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useRouteState('slug', { parser: slugParser })).toEqualTypeOf<Ref<string>>()
  })

  it('zod schemas (structural, no zod import)', () => {
    expectTypeOf(
      useRouteState('user', { parser: z.object({ name: z.string() }) }),
    ).toEqualTypeOf<Ref<{ name: string }>>()
    expectTypeOf(useRouteState('s', { parser: z.string().min(2) })).toEqualTypeOf<Ref<string>>()
  })

  it('default-value inference', () => {
    expectTypeOf(useRouteState('page', { default: 1 })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useRouteState('name', { default: 'x' })).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useRouteState('flag', { default: false })).toEqualTypeOf<Ref<boolean>>()
    expectTypeOf(useRouteState('from', { default: new Date() })).toEqualTypeOf<Ref<Date>>()
    expectTypeOf(useRouteState('filter', { default: { a: 1 } })).toEqualTypeOf<Ref<{ a: number }>>()
  })

  it('shorthand plus default stays typed by the parser', () => {
    expectTypeOf(useRouteState('page', { type: 'integer', default: 1 })).toEqualTypeOf<Ref<number>>()
  })
})

describe('useRouteStates type inference', () => {
  it('maps each key to its inferred Ref type', () => {
    expectTypeOf(
      useRouteStates({
        page: { type: 'integer' },
        q: { default: '' },
        flag: { type: 'boolean', default: true },
      }),
    ).toEqualTypeOf<{ page: Ref<number>; q: Ref<string>; flag: Ref<boolean> }>()
  })

  it('infers zod and custom parser types', () => {
    expectTypeOf(
      useRouteStates({
        user: { parser: z.object({ id: z.number() }) },
        nums: { parser: arrayParser(integerParser), default: [] },
      }),
    ).toEqualTypeOf<{ user: Ref<{ id: number }>; nums: Ref<number[]> }>()
  })

  it('infers enum and slug types in groups', () => {
    expectTypeOf(
      useRouteStates({
        status: { parser: enumParser(['draft', 'live'] as const), default: 'draft' },
        section: { type: 'slug' },
      }),
    ).toEqualTypeOf<{ status: Ref<'draft' | 'live'>; section: Ref<string> }>()
  })
})
