/**
 * The raw value of a query parameter as provided by vue-router's `route.query`.
 * A param can appear once (`string`), multiple times (`string[]`), or be
 * valueless (`null`).
 */
export type RawQueryValue = string | string[] | null

/**
 * A type-safe serializer/deserializer between a URL query value and the state value.
 *
 * - `parse` receives the raw query value. Returning `null` signals "unparseable" —
 *   the composable falls back to the configured `default` and logs a dev warning.
 * - `serialize` produces the URL representation. Returning `null` (or an empty
 *   array) signals "remove this param from the URL".
 */
export interface Parser<T> {
  parse(raw: RawQueryValue): T | null
  serialize(value: T): string | string[] | null
  /** Internal marker: set by `arrayParser` so the core can detect scalar/array mismatch. */
  isArrayParser?: boolean
}

/**
 * Structural stand-in for a Zod schema. This deliberately avoids importing
 * `zod` (an optional peer dependency) — real Zod schemas satisfy this shape
 * structurally, and `ZodOutput` extracts the parsed output type from the
 * schema's own `safeParse` signature.
 */
export interface ZodLike<T = any> {
  safeParse(data: unknown): ZodSafeParseReturn<T>
}

export type ZodSafeParseReturn<T> =
  | { success: true; data: T }
  | { success: false; error: unknown }

/** The output (post-transform) type of a Zod-like schema. */
export type ZodOutput<S> = S extends { safeParse(data: unknown): infer R }
  ? R extends { success: true; data: infer D }
    ? D
    : never
  : never

/**
 * Coerce a raw query value to a single string, taking the first element when
 * the param appears multiple times (used by scalar parsers).
 */
export function singleValue(raw: RawQueryValue): string | null {
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }
  return raw
}
