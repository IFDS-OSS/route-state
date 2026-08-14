import { effectScope, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import {
  arrayParser,
  booleanParser,
  dateParser,
  floatParser,
  jsonParser,
  parserRegistry,
  stringParser,
  zodParser,
} from './parsers'
import type {
  Parser,
  ParserKey,
  ParserTypeByKey,
  RawQueryValue,
  ZodLike,
  ZodOutput,
} from './parsers'

// ---------------------------------------------------------------------------
// Public option & call-signature types
// ---------------------------------------------------------------------------

export interface RouteStateOptions<T = unknown> {
  /** Shorthand parser key, e.g. `'number'`, `'boolean'` — mutually exclusive with `parser`. */
  type?: ParserKey
  /** Custom `Parser<T>`, Zod schema, or shorthand key string. */
  parser?: Parser<T> | ZodLike<T> | ParserKey
  /** Value used when the param is absent or unparseable. */
  default?: T
  /** `'replace'` (default) or `'push'` history entry on writes. */
  history?: 'push' | 'replace'
  /** Coalesce rapid writes; only the final value after a pause is written (opt-in). */
  debounce?: number
  /** When `false` (default), the param is dropped and the state resets on `route.path` change. */
  persist?: boolean
  /** What to do with the URL when the value is `undefined`/`null`: remove the param or keep it empty. */
  clear?: 'remove' | 'empty'
  /** Use a shallow ref for the state (perf for large JSON values). */
  shallow?: boolean
}

/**
 * `useRouteState` call signatures. The state type `T` is always derived from
 * the parser — never hand-asserted:
 *
 * 1. no options → `Ref<string>` (string parser)
 * 2. shorthand `{ type: 'number' }` / `{ parser: 'integer' }` → typed by key
 * 3. custom `Parser<T>` → `Ref<T>`
 * 4. Zod schema → `Ref<z.output>` (structural, no zod import)
 * 5. `{ default: T }` → parser inferred from the default's runtime type
 */
export interface UseRouteState {
  (key: string, options?: Omit<RouteStateOptions<string>, 'type' | 'parser'>): Ref<string>
  <const K extends ParserKey>(
    key: string,
    options: RouteStateOptions & ({ type: K } | { parser: K }),
  ): Ref<ParserTypeByKey[K]>
  <T>(key: string, options: RouteStateOptions<T> & { parser: Parser<T> }): Ref<T>
  // Note: must NOT intersect with RouteStateOptions['parser'] — structural checks
  // against zod's generic class types break inside the intersection.
  <S extends ZodLike>(
    key: string,
    options: { parser: S } & Partial<Omit<RouteStateOptions, 'parser' | 'type'>>,
  ): Ref<ZodOutput<S>>
  <T>(key: string, options: RouteStateOptions<T> & { default: T }): Ref<WidenLiteral<T>>
}

/** Widen literal types inferred from `default` values ('' → string, 1 → number, etc.). */
export type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T extends readonly unknown[]
          ? Array<WidenLiteral<T[number]>>
          : T


/** Infer the state value type from a `useRouteStates` entry's options. */
export type InferStateType<O> =
  O extends { type: infer K extends ParserKey }
    ? ParserTypeByKey[K]
    : O extends { parser: infer P }
      ? P extends Parser<any>
        ? P extends Parser<infer T>
          ? T
          : never
        : P extends ParserKey
          ? ParserTypeByKey[P]
          : P extends ZodLike<any>
            ? ZodOutput<P>
            : never
      : O extends { default: infer D }
        ? WidenLiteral<D>
        : string

export interface UseRouteStates {
  <const S extends Record<string, RouteStateOptions<any>>>(
    states: S,
  ): { -readonly [K in keyof S]: Ref<InferStateType<S[K]>> }
}

// ---------------------------------------------------------------------------
// Dependency injection (unit-testable without Nuxt)
// ---------------------------------------------------------------------------

export interface RouteStateDeps {
  router: Router
  /** Per-app shared store (key → state entry). Falls back to a fresh Map. */
  store?: Map<string, RouteStateEntry>
  /** Component-scoped `onMounted`; its absence means "not in a component setup". */
  onMounted?: (fn: () => void) => void
  isClient?: boolean
  isDev?: boolean
}

export interface RouteStateEntry<T = any> {
  key: string
  ref: Ref<T>
  parser: Parser<T>
  default: T
  history: 'push' | 'replace'
  debounce?: number
  persist: boolean
  clear: 'remove' | 'empty'
  shallow: boolean
  /** Keys merged into a single router call on writes (the `useRouteStates` group). */
  group: string[]
  applyingFromRoute: boolean
  hydrated: boolean
  deps: RouteStateDeps
  scope: ReturnType<typeof effectScope>
  _timeout?: ReturnType<typeof setTimeout>
  _warned?: Set<string>
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isClient(deps: RouteStateDeps): boolean {
  return deps.isClient ?? (typeof window !== 'undefined')
}

function isDev(deps: RouteStateDeps): boolean {
  return deps.isDev ?? (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production')
}

function devWarn(deps: RouteStateDeps, message: string): void {
  if (isDev(deps)) {
    // eslint-disable-next-line no-console
    console.warn(`[@ifds/route-state] ${message}`)
  }
}

function isEmptyQueryValue(raw: unknown): boolean {
  return (
    raw === undefined ||
    raw === null ||
    raw === '' ||
    (Array.isArray(raw) && raw.length === 0)
  )
}

/** Compare a vue-router query value against a serialized target (null items normalize to ''). */
function sameValue(current: unknown, target: string | string[]): boolean {
  if (Array.isArray(target)) {
    const cur: unknown[] = Array.isArray(current) ? current : [current]
    if (cur.length !== target.length) return false
    return target.every((t, i) => {
      const c = cur[i]
      return c === t || (c === null && t === '')
    })
  }
  return current === target || (current === null && target === '')
}

// ---------------------------------------------------------------------------
// Parser resolution
// ---------------------------------------------------------------------------

interface ResolvedOptions<T = any> {
  parser: Parser<T>
  default: T
}

function inferFromDefault(dflt: unknown): ResolvedOptions {
  if (dflt === undefined) return { parser: stringParser, default: '' }
  if (dflt === null) return { parser: jsonParser, default: null }
  if (typeof dflt === 'number') return { parser: floatParser, default: dflt }
  if (typeof dflt === 'string') return { parser: stringParser, default: dflt }
  if (typeof dflt === 'boolean') return { parser: booleanParser, default: dflt }
  if (dflt instanceof Date) return { parser: dateParser, default: dflt }
  if (Array.isArray(dflt)) {
    const item = dflt.length > 0 ? inferFromDefault(dflt[0]).parser : stringParser
    return { parser: arrayParser(item), default: dflt }
  }
  if (typeof dflt === 'object') return { parser: jsonParser, default: dflt }
  return { parser: stringParser, default: dflt }
}

function resolveOptions<T>(options?: RouteStateOptions<T>): ResolvedOptions<T> {
  const { type, parser, default: dflt } = options ?? {}
  if (type) {
    return { parser: parserRegistry[type] as Parser<T>, default: dflt as T }
  }
  if (typeof parser === 'string') {
    return { parser: parserRegistry[parser] as Parser<T>, default: dflt as T }
  }
  if (parser && typeof (parser as ZodLike).safeParse === 'function') {
    return { parser: zodParser(parser as ZodLike) as Parser<T>, default: dflt as T }
  }
  if (parser) {
    return { parser: parser as Parser<T>, default: dflt as T }
  }
  return inferFromDefault(dflt) as ResolvedOptions<T>
}

// ---------------------------------------------------------------------------
// Entry lifecycle: create, hydrate, watch, write
// ---------------------------------------------------------------------------

function parseOrDefault<T>(entry: RouteStateEntry<T>, raw: unknown): T {
  if (isEmptyQueryValue(raw)) {
    return entry.default
  }
  if (Array.isArray(raw) && !entry.parser.isArrayParser) {
    devWarn(
      entry.deps,
      `"${entry.key}" received multiple values but uses a scalar parser — using the first.`,
    )
  }
  const parsed = entry.parser.parse(raw as RawQueryValue)
  if (parsed === null) {
    devWarn(
      entry.deps,
      `Could not parse "${entry.key}" value ${JSON.stringify(raw)} — falling back to the default.`,
    )
    return entry.default
  }
  return parsed
}

function createEntry<T>(
  key: string,
  resolved: ResolvedOptions<T>,
  options: RouteStateOptions<T> | undefined,
  deps: RouteStateDeps,
  group: string[],
): RouteStateEntry<T> {
  const history = options?.history ?? 'replace'
  const debounce = options?.debounce
  const persist = options?.persist ?? false
  const clear = options?.clear ?? 'remove'
  const shallow = options?.shallow ?? false

  // Detached scope: the shared ref + watchers must survive component unmounts
  // and avoid cross-component-scope warnings.
  const scope = effectScope(true)
  const entry: RouteStateEntry<T> = scope.run(() => {
    const stateRef: Ref<T> = shallow
      ? (shallowRef(resolved.default) as Ref<T>)
      : (ref(resolved.default) as Ref<T>)
    return {
      key,
      ref: stateRef,
      parser: resolved.parser,
      default: resolved.default,
      history,
      debounce,
      persist,
      clear,
      shallow,
      group,
      applyingFromRoute: false,
      hydrated: false,
      deps,
      scope,
    }
  })!

  if (isClient(deps)) {
    scope.run(() => {
      const { router } = deps

      // State → URL
      watch(
        () => entry.ref.value,
        (value) => {
          if (entry.applyingFromRoute) return
          if (debounce && debounce > 0) {
            clearTimeout(entry._timeout)
            entry._timeout = setTimeout(() => writeToUrl(entry), debounce)
          } else {
            writeToUrl(entry)
          }
        },
        { flush: 'sync' },
      )

      // URL → State (covers back/forward, address-bar edits, external pushes)
      watch(
        () => router.currentRoute.value.query[entry.key],
        (raw) => {
          entry.applyingFromRoute = true
          entry.ref.value = parseOrDefault(entry, raw)
          entry.applyingFromRoute = false
        },
      )

      // Route change → reset (unless `persist`)
      watch(
        () => router.currentRoute.value.path,
        () => schedulePathReset(entry),
      )
    })
  }

  return entry
}

function hydrateEntry<T>(entry: RouteStateEntry<T>): void {
  if (entry.hydrated) return
  entry.hydrated = true
  const raw = entry.deps.router.currentRoute.value.query[entry.key]
  entry.applyingFromRoute = true
  entry.ref.value = parseOrDefault(entry, raw)
  entry.applyingFromRoute = false
}

function writeToUrl<T>(entry: RouteStateEntry<T>): void {
  const { router } = entry.deps
  const store = entry.deps.store
  const currentQuery = router.currentRoute.value.query
  const query = { ...currentQuery }
  let changed = false

  for (const key of entry.group) {
    const groupEntry = store?.get(key)
    if (!groupEntry) continue

    const value = groupEntry.ref.value
    let target: string | string[] | null
    if (value === undefined || value === null) {
      target = groupEntry.clear === 'empty' ? '' : null
    } else {
      target = groupEntry.parser.serialize(value)
      if (target === null && groupEntry.clear === 'empty') {
        target = ''
      }
    }

    if (target === null) {
      if (key in currentQuery) {
        changed = true
        delete query[key]
      }
    } else if (!sameValue(currentQuery[key], target)) {
      changed = true
      query[key] = target
    }
  }

  if (!changed) return

  const navigate = entry.history === 'push' ? router.push : router.replace
  void navigate({ query })
}

// Microtask-coalesced path resets (one router call per navigation)
let pendingResets: RouteStateEntry[] | undefined
let resetScheduled = false

function schedulePathReset(entry: RouteStateEntry): void {
  if (entry.persist) return
  pendingResets ??= []
  if (pendingResets.includes(entry)) return
  pendingResets.push(entry)
  if (resetScheduled) return
  resetScheduled = true
  queueMicrotask(flushPathResets)
}

function flushPathResets(): void {
  resetScheduled = false
  const entries = pendingResets ?? []
  pendingResets = undefined
  if (entries.length === 0) return

  const router = entries[0].deps.router
  const query = { ...router.currentRoute.value.query }
  let changed = false

  for (const entry of entries) {
    entry.applyingFromRoute = true
    entry.ref.value = entry.default
    entry.applyingFromRoute = false
    if (entry.key in query) {
      changed = true
      delete query[entry.key]
    }
  }

  if (changed) {
    void router.replace({ query })
  }
}

function checkConflicts<T>(entry: RouteStateEntry<T>, key: string, resolved: ResolvedOptions<T>): void {
  if (!isDev(entry.deps)) return
  const warned = (entry._warned ??= new Set())
  const conflicts: string[] = []
  if (resolved.parser !== entry.parser) conflicts.push('a different parser')
  if (resolved.default !== entry.default) conflicts.push('a different default value')
  if (conflicts.length > 0 && !warned.has(conflicts.join(','))) {
    warned.add(conflicts.join(','))
    devWarn(
      entry.deps,
      `"${key}" is shared globally but was called with ${conflicts.join(' and ')} — the first call wins.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Public factories
// ---------------------------------------------------------------------------

function createState<T>(
  key: string,
  options: RouteStateOptions<T> | undefined,
  deps: RouteStateDeps,
  group?: string[],
): Ref<T> {
  // Not in a component setup context → local-only ref, no URL sync (spec §7)
  if (!deps.onMounted) {
    devWarn(
      deps,
      `\`${key}\` was called outside a component's setup() — returning a local ref without URL sync.`,
    )
    return ref(resolveOptions(options).default) as Ref<T>
  }

  const store = deps.store ?? (deps.store = new Map<string, RouteStateEntry>())
  const resolved = resolveOptions(options)
  let entry = store.get(key) as RouteStateEntry<T> | undefined

  if (!entry) {
    entry = createEntry(key, resolved, options, deps, group ?? [key])
    store.set(key, entry)
  } else {
    checkConflicts(entry, key, resolved)
  }

  // Client-only URL sync (spec §8): apply URL values only after hydration to
  // keep the first client render identical to the SSR output (no mismatch).
  if (isClient(deps)) {
    deps.onMounted(() => hydrateEntry(entry!))
  }

  return entry.ref
}

/**
 * Create a `useRouteState` function bound to the given dependencies.
 * The Nuxt wrapper injects `useRouter`/`useNuxtApp`-derived deps.
 */
export function createRouteState(deps: RouteStateDeps): UseRouteState {
  return function useRouteState(key: string, options?: RouteStateOptions<any>): Ref<any> {
    return createState(key, options, deps)
  } as UseRouteState
}

/**
 * Create a `useRouteStates` function bound to the given dependencies.
 * All keys form a write group: each change merges the group's current values
 * into a single router call.
 */
export function createRouteStates(deps: RouteStateDeps): UseRouteStates {
  return function useRouteStates(states: Record<string, RouteStateOptions<any>>) {
    const keys = Object.keys(states)
    const result: Record<string, Ref<any>> = {}
    for (const key of keys) {
      result[key] = createState(key, states[key], deps, keys)
    }
    return result
  } as UseRouteStates
}
