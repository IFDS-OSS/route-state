# @ifds/route-state

Type-safe, SSR-safe state management for Nuxt that syncs state with the URL's query parameters — **`useState` for the URL**.

```ts
const page = useRouteState('page', { type: 'integer', default: 1 })
page.value = 2 // → router.replace({ query: { ...route.query, page: '2' } })
```

Shareable, bookmarkable page state (pagination, filters, search, tabs) with full type inference, built-in parsers, and Nuxt 3 + Nuxt 4 support.

## Install

```bash
npm i @ifds/route-state
# optional, for schema-based states:
npm i zod
```

Add to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@ifds/route-state'],
})
```

`useRouteState`, `useRouteStates`, and the parser factories (`arrayParser`, `zodParser`, `jsonParser`, …) are auto-imported — no manual imports needed.

## Usage

### Strings (default)

```ts
const name = useRouteState('name') // Ref<string>, default ''
const q    = useRouteState('q', { default: 'all', debounce: 200 })
```

### Built-in parsers

```ts
const page    = useRouteState('page', { type: 'integer', default: 1 })   // ?page=2
const price   = useRouteState('price', { type: 'float', default: 2.5 })  // ?price=3.14
const flag    = useRouteState('flag', { type: 'boolean', default: false }) // ?flag=true / ?flag=false
const from    = useRouteState('from', { type: 'date', default: new Date() }) // ISO-8601 UTC
const raw     = useRouteState('raw', { type: 'json' })
const section = useRouteState('section', { type: 'slug', default: 'getting-started' }) // ?section=getting-started
```

### Enums — a fixed set of values

```ts
const status = useRouteState('status', {
  parser: enumParser(['draft', 'published', 'archived'] as const), // Ref<'draft' | 'published' | 'archived'>
  default: 'draft',
})
// → ?status=published
```

String and number enums both work (`enumParser([1, 2, 3] as const)`); anything outside the set falls back to the default (+ dev warning).

### Arrays — repeated params

```ts
const tags = useRouteState('tags', {
  parser: arrayParser(stringParser), // or arrayParser(integerParser), …
  default: ['vue', 'nuxt'],
})
// → ?tags=vue&tags=nuxt
```

### JSON objects — single encoded param

```ts
const filter = useRouteState('filter', { parser: jsonParser, default: { status: 'active' } })
// → ?filter=%7B%22status%22%3A%22active%22%7D
```

### Zod schemas (validation + type inference)

```ts
const userSchema = z.object({ name: z.string().min(2), age: z.number().int() })
const user = useRouteState('user', {
  parser: zodParser(userSchema),
  default: { name: 'buffy', age: 1 },
})
// Invalid values fall back to the default (+ dev warning). Type is z.output.
```

### Multi-key: `useRouteStates`

Manage several params in one call. Every write merges all managed keys into a **single router call** (no stale-copy overwrites).

```ts
const { sort, limit } = useRouteStates({
  sort: { default: 'recent' },
  limit: { type: 'integer', default: 20 },
})
limit.value = 50 // → one router.replace merging { sort, limit }
```

### Custom parsers

```ts
interface Parser<T> {
  parse(raw: string | string[] | null): T | null // null ⇒ unparseable ⇒ default (+ dev warn)
  serialize(value: T): string | string[] | null   // null ⇒ remove param
}

const upperParser: Parser<string> = {
  parse: (raw) => (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase() ?? null,
  serialize: (v) => v.toUpperCase(),
}
const name = useRouteState('name', { parser: upperParser, default: '' })
```

### Options API

Works inside `setup()` of Options-API components (the standard Vue 3 composable path):

```ts
export default defineComponent({
  setup() {
    return { page: useRouteState('page', { type: 'integer', default: 1 }) },
  },
  methods: {
    go(p: number) { this.page = p },
  },
})
```

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `type` | `'string' \| 'number' \| 'float' \| 'integer' \| 'boolean' \| 'date' \| 'json' \| 'slug'` | — | Shorthand selecting a built-in parser |
| `parser` | `Parser<T> \| ZodSchema \| parser key` | string parser | Custom parser, Zod schema, or shorthand key |
| `default` | `T` | `''` | Value when the param is absent or unparseable |
| `history` | `'replace' \| 'push'` | `'replace'` | How writes are applied; `push` lets back step through changes |
| `debounce` | `number` (ms) | off | Coalesce rapid writes; only the final value after a pause is written |
| `persist` | `boolean` | `false` | Keep the param across `route.path` changes (otherwise it resets) |
| `clear` | `'remove' \| 'empty'` | `'remove'` | URL behavior when the value is `undefined`/`null`/empty array |
| `shallow` | `boolean` | `false` | Use a shallow ref (perf for large JSON values) |

## Behavior notes

- **Type inference** is always derived from the parser: shorthand key, custom `Parser<T>`, Zod schema (`z.output`), or the `default` value's runtime type.
- **SSR (client-only sync):** values are applied after hydration from the URL. Server and first client render both show defaults — no hydration mismatch. Tradeoff: a brief flash of defaults, and SSR HTML does not reflect query state (interactive state by design).
- **Back/forward:** query changes are watched; the shared ref updates reactively without page reloads.
- **Route changes:** by default the param is dropped and the state resets to its default when `route.path` changes (nested routes included). Set `persist: true` to keep it.
- **Sharing:** `useRouteState('key')` in multiple components returns the same underlying ref (like `useState`). The first call's parser/default win; conflicting later calls log a dev warning.
- **Edge cases:** empty string `?q=` → default; malformed values → default + dev warning; `NaN`/`Infinity` → param removed; multiple values for a scalar param → first value + dev warning; non-component contexts → local ref + dev warning.
- **Deep mutations** of object states (e.g. `state.value.filter.x = 1`) update templates but do **not** sync to the URL — replace the whole value instead (the URL is a string).

## Development

```bash
npm install
npm run dev        # playground (module loaded from source)
npm run test       # vitest — parsers + composable behavior
npm run typecheck  # vue-tsc on src + tests
npm run build      # unbuild → dist/
```

### Nuxt 4 parity

Nuxt 3 and Nuxt 4 can't share one `node_modules`, so the Nuxt 4 playground is a standalone app with its own install that consumes the **built** module — the same path real `npm i @ifds/route-state` users take.

```bash
cd playground-nuxt4 && npm install   # one-time: Nuxt 4 deps
cd ..
npm run prepare:nuxt4               # unbuild → dist/ → vendored into playground-nuxt4/node_modules
npm run build:nuxt4                  # nuxt build against the vendored module
npm run dev:nuxt4                    # dev server (Nuxt 4)
```

The vendored copy resolves `nuxt/app`, `vue`, and `vue-router` from the app's **own** Nuxt 4 install, and the module has no Nuxt-4-only internals (`compatibility: { nuxt: '>=3.0.0' }`) — so a passing `build:nuxt4` plus the SSR smoke test is parity evidence for both majors.
