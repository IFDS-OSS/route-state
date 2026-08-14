import type { Parser, RawQueryValue, ZodLike, ZodOutput } from './types'

/**
 * Zod schema parser (locked spec §13.3).
 *
 * - Parsing goes through `schema.safeParse`; failures fall back to the default
 *   (+ dev warn). The parsed value is the schema's *output* (transforms applied).
 * - Serialization is driven by the output value's runtime type, never by schema
 *   internals: primitives → `String(value)`, `Date` → ISO-8601, objects/arrays → JSON.
 * - Raw array values (repeated params) are passed through as-is, so
 *   `z.array(...)` schemas work with repeated params.
 *
 * No runtime import of `zod` — the schema is used structurally.
 */
export function zodParser<S extends ZodLike<any>>(schema: S): Parser<ZodOutput<S>> {
  const attempt = (data: unknown): ZodOutput<S> | null => {
    const result = schema.safeParse(data)
    return result.success ? (result.data as ZodOutput<S>) : null
  }
  return {
    parse(raw: RawQueryValue): ZodOutput<S> | null {
      // The raw URL value is a string; try it as-is first (covers z.string(),
      // z.coerce.number(), repeated-param arrays, …), then fall back to
      // JSON-decoding it (covers object/array schemas serialized as JSON).
      const direct = attempt(raw)
      if (direct !== null) return direct
      if (typeof raw === 'string') {
        try {
          return attempt(JSON.parse(raw))
        } catch {
          return null
        }
      }
      return null
    },
    serialize(value: ZodOutput<S>): string | null {
      if (value === null || value === undefined) {
        return null
      }
      if ((value as unknown) instanceof Date) {
        return Number.isNaN((value as Date).getTime()) ? null : (value as Date).toISOString()
      }
      const type = typeof value
      if (type === 'string' || type === 'number' || type === 'boolean') {
        return String(value)
      }
      try {
        const serialized = JSON.stringify(value)
        return typeof serialized === 'string' ? serialized : null
      } catch {
        return null
      }
    },
  }
}
