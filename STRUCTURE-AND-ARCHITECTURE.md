# @ifds/route-state — Structure & Architecture

## Project tree

```
route-state/
├── package.json               # "@ifds/route-state" — single publishable package (not a monorepo)
├── tsconfig.json               # strict TS config, bundler resolution
├── build.config.ts             # unbuild config → dist/
├── vitest.config.ts            # node env, test/**/*.test.ts
├── .gitignore
│
├── src/
│   ├── module.ts                # defineNuxtModule — registers auto-imports, transpiles runtime/
│   ├── module.d.ts              # hand-written stub type (see "Why module.d.ts is hand-written" below)
│   └── runtime/
│       ├── core.ts              # framework-agnostic engine: entry lifecycle, URL⇄state sync, DI
│       ├── composables/
│       │   ├── useRouteState.ts   # Nuxt-bound single-key composable (wraps core.createRouteState)
│       │   └── useRouteStates.ts  # Nuxt-bound multi-key composable (wraps core.createRouteStates)
│       └── parsers/
│           ├── types.ts           # Parser<T>, RawQueryValue, ZodLike/ZodOutput, singleValue()
│           ├── string.ts          # default parser — empty string ⇒ absent
│           ├── integer.ts         # strict integer, safe-integer bounded
│           ├── float.ts           # number/float, NaN/Infinity ⇒ unrepresentable
│           ├── boolean.ts         # 'true'/'1' | 'false'/'0'
│           ├── date.ts            # ISO-8601 UTC via toISOString
│           ├── json.ts            # single JSON-encoded param
│           ├── slug.ts            # strict lowercase-hyphen validation (no normalization)
│           ├── enum.ts            # factory: fixed value set, string/number both work
│           ├── array.ts           # factory: repeated params (?tags=a&tags=b), whole-array invalidation
│           ├── zod.ts             # factory: Zod schema, output-type-driven serialize, no runtime zod import
│           └── index.ts           # re-exports + parserRegistry (shorthand `type: 'integer'` lookup)
│
├── test/
│   ├── core.test.ts             # entry lifecycle, URL sync, grouping, persistence, conflicts — DI-based, no Nuxt
│   ├── parsers.test.ts          # parse/serialize round-trips + invalid-input fallback per parser
│   └── types.test.ts            # compile-time type-inference assertions (UseRouteState overloads)
│
├── scripts/
│   └── prepare-nuxt4.mjs        # builds dist/ then vendors it into playground-nuxt4/node_modules
│
├── playground/                  # Nuxt 3 dev playground — module loaded from src/ (not built)
│   ├── nuxt.config.ts
│   ├── app.vue
│   └── pages/{index,other}.vue  # `other.vue` exists to exercise route-change resets
│
└── playground-nuxt4/            # Nuxt 4 parity playground — standalone app, own node_modules/package.json
    ├── nuxt.config.ts
    ├── package.json             # separate install; Nuxt 3 and 4 can't share one node_modules
    └── pages/{index,other}.vue
```

Unlike `hydration-lens`, this is **one package, not a pnpm monorepo** — there's no `packages/*` split because there's only one runtime to ship (a Nuxt module). The framework-agnostic/framework-bound split still exists, just at the file level (`runtime/core.ts` vs. `runtime/composables/*.ts`) instead of the package level.

## The core idea

`core.ts` is a pure, dependency-injected engine that knows nothing about Nuxt. It's driven entirely through the `RouteStateDeps` interface (`router`, `store`, `onMounted`, `isClient`, `isDev`), which is why `test/core.test.ts` can exercise entry creation, URL sync, grouping, path-reset, and conflict-warning behavior with a fake `vue-router` `Router` and no Nuxt app at all.

```
composables/useRouteState.ts (Nuxt-bound)
   │  useNuxtApp() / useRouter() / getCurrentInstance()
   ▼
buildDeps() → RouteStateDeps { router, store, onMounted, isClient }
   │
   ▼
core.ts: createRouteState(deps) → useRouteState(key, options)
   │
   ▼
createState() ─┬─ new key  → createEntry()  (ref + 3 watchers, in a detached effectScope)
               └─ known key → checkConflicts() (dev-only warning), return existing entry.ref
   │
   ▼
Ref<T> returned to the component
```

Only `module.ts` and the two `composables/*.ts` files know Nuxt exists (`@nuxt/kit`, `nuxt/app`). Everything downstream — parsing, serializing, the state/URL sync loop, grouping, persistence, resets — lives in `core.ts` and the `parsers/` tree, both framework-agnostic Vue/vue-router code.

## Dependency injection (`RouteStateDeps`)

`core.ts` never imports `nuxt/app` or `@nuxt/kit`. Every external capability it needs is passed in:

- `router: Router` — a real or fake vue-router instance.
- `store?: Map<string, RouteStateEntry>` — per-app shared state; falls back to a fresh `Map` if omitted.
- `onMounted?: (fn) => void` — component-scoped lifecycle hook. Its **absence** is the signal for "not inside a component's `setup()`" (see below), not a separate flag.
- `isClient?: boolean` — defaults to `typeof window !== 'undefined'`; overridable for tests.
- `isDev?: boolean` — defaults to `NODE_ENV !== 'production'`; overridable for tests.

The Nuxt composables (`useRouteState.ts`, `useRouteStates.ts`) each have their own `buildDeps()` that resolves these from `useNuxtApp()`/`useRouter()`/`getCurrentInstance()`, then delegate everything else to `core.ts`. This is the seam that makes ~all of the interesting logic unit-testable without spinning up Nuxt.

## Server vs. client store isolation

Both composables keep two separate stores:

- **Client:** one module-level `clientStore` `Map`, shared across the whole SPA lifetime (matches `useState`'s per-app-instance sharing model).
- **Server:** a `WeakMap<NuxtApp, Map>` keyed by the current `nuxtApp` instance, so each SSR request gets its own isolated store — no state leaking between concurrent requests on the same server process.

## Entry lifecycle (`core.ts`)

A `RouteStateEntry` is created once per key (first caller wins) and holds the shared `Ref`, resolved `Parser`, defaults, options, and a detached `effectScope`:

1. **`createEntry()`** — runs inside `effectScope(true)` (detached: survives the creating component's unmount, since the entry is shared globally by key). Sets up three `watch()`es, client-only:
   - **State → URL**: `flush: 'sync'` watch on the ref; debounces via `setTimeout` if `debounce` is set, else writes immediately. Guarded by `entry.applyingFromRoute` so URL→state writes don't bounce back into state→URL.
   - **URL → State**: watches `router.currentRoute.value.query[key]`, covering back/forward navigation, address-bar edits, and pushes from elsewhere.
   - **Route change → reset**: watches `route.path`; calls `schedulePathReset()` unless `persist: true`.
2. **`hydrateEntry()`** — runs once, from `onMounted`, not at creation time. This is the SSR-safety mechanism: server render and the client's first render both show the parser's `default`, so there's no hydration mismatch. The URL's actual value is only applied after mount, which is also why there's a brief flash-of-default on first paint by design.
3. **`writeToUrl()`** — the single write path, used by both immediate and debounced writes. Serializes **every key in `entry.group`** (not just the changed one) and merges into one `router.push`/`router.replace({ query })` call — this is what makes `useRouteStates` atomic instead of racing separate replaces that clobber each other's `route.query` snapshot.
4. **`schedulePathReset()` / `flushPathResets()`** — path-change resets are coalesced via `queueMicrotask` into a single router call across every non-persisted entry, rather than one `router.replace` per key.

## Parser resolution (`resolveOptions` / `inferFromDefault`)

Four ways to end up with a `Parser<T>`, checked in this order in `resolveOptions()`:

1. `type: 'integer'` (etc.) → looked up in `parserRegistry`.
2. `parser: 'integer'` (string form) → same registry lookup.
3. `parser: someZodSchema` → detected structurally via `typeof parser.safeParse === 'function'` (no `instanceof`, since `zod` is an optional peer dependency never imported at runtime) → wrapped with `zodParser()`.
4. `parser: customParserObject` → used as-is.
5. Neither `type` nor `parser` → `inferFromDefault(options.default)` walks the default value's runtime type (`number` → float, `boolean` → boolean, `Date` → date, `Array` → `arrayParser` of the first element's inferred parser, plain `object` → JSON, else string).

This is also where `UseRouteState`'s five call-signature overloads (`src/runtime/core.ts`) get their type safety: each corresponds 1:1 to a branch above, so the returned `Ref<T>`'s `T` always matches what `resolveOptions` will actually produce at runtime.

## Parsers (`runtime/parsers/`)

Every parser implements the same two-method `Parser<T>` contract (`parse`/`serialize`), with one convention held consistently across all of them: **anything unrepresentable returns `null`**, never throws. `core.ts`'s `parseOrDefault()` is the only place that turns a `null` into "fall back to default + dev-warn" — parsers themselves stay pure.

- `singleValue()` is the shared helper every scalar parser uses to collapse `string | string[] | null` down to `string | null` (first element wins on accidental repeats).
- `arrayParser(itemParser)` is the one parser that changes the *shape* of parsing: **whole-array invalidation** — if any item fails, the entire array falls back to default, not just the bad item. It also sets `isArrayParser: true`, the marker `core.ts` checks in `parseOrDefault()` to warn when a scalar parser receives a repeated param.
- `zodParser(schema)` never imports `zod` at runtime — `ZodLike`/`ZodOutput` in `parsers/types.ts` are structural types extracted from the schema's own `safeParse` signature. `parse()` tries the raw string value first (covers `z.coerce.number()`, `z.string()`, repeated-param arrays), then falls back to `JSON.parse` for object/array schemas. `serialize()` branches on the *output value's* runtime type rather than inspecting schema internals, so it works uniformly regardless of what transforms the schema applied.
- `slugParser` deliberately **rejects** malformed input rather than normalizing it (e.g. lowercasing), specifically to keep `parse(serialize(x)) === x` a true invariant rather than a rounding hazard.

## Auto-imports and Nuxt integration (`module.ts`)

`defineNuxtModule` does two things at `setup()`:

1. `addImports([...])` registers both composables and every parser factory/built-in as Nuxt auto-imports, resolved from `runtime/`. Unused ones are tree-shaken — importing the module doesn't force-include parsers a project never references.
2. `nuxt.options.build.transpile.push(runtimeDir)` — transpiles the runtime directory so its source-level modules resolve correctly when consumed from outside `node_modules` (relevant to the `playground` dev flow, where the module runs from `src/` rather than a built `dist/`).

### Why `module.d.ts` is hand-written (`build.config.ts`)

The module entry (`src/module.ts`) is built with `declaration: false` and its type stub is a **hand-copied** `module.d.ts`, not a generated one. Generating a real declaration for the module entry would pull `@nuxt/kit` → `vite` → `rollup`'s types into the declaration graph and break the build; since Nuxt only ever loads `module.mjs` at runtime and consumer-facing types come entirely from `runtime/*.d.ts`, the stub (`declare const _default: any; export default _default`) is sufficient and avoids that dependency chain entirely.

## Nuxt 3 / Nuxt 4 parity (`playground-nuxt4/`, `scripts/prepare-nuxt4.mjs`)

Nuxt 3 and Nuxt 4 can't coexist in one `node_modules`, so `playground-nuxt4` is a fully separate app with its own `package.json`/install — not a workspace member. `prepare-nuxt4.mjs`:

1. Builds `dist/` via `unbuild`.
2. Vendors that build into `playground-nuxt4/node_modules/@ifds/route-state/`, writing a synthetic `package.json` alongside it.

This means the Nuxt 4 playground resolves `nuxt/app`, `vue`, `vue-router`, and `@nuxt/kit` from **its own** install rather than the root workspace's — the same resolution path a real `npm i @ifds/route-state` consumer would hit. Combined with `compatibility: { nuxt: '>=3.0.0' }` in `module.ts` (no Nuxt-4-only internals used), a passing `build:nuxt4` is real parity evidence, not just "it typechecks."

## Testing strategy

- `test/core.test.ts`: exercises `createRouteState`/`createRouteStates` against a fake `Router` + `RouteStateDeps` — entry creation, state→URL and URL→state sync, `useRouteStates` grouping/atomicity, `persist`, debounce, and the dev-mode conflict warning. No Nuxt involved, since `core.ts` doesn't depend on it.
- `test/parsers.test.ts`: `parse`/`serialize` round-trips and invalid-input → `null` fallback, per parser.
- `test/types.test.ts`: compile-time-only assertions that `UseRouteState`'s overloads resolve to the right `Ref<T>` for each call shape (shorthand key, custom `Parser<T>`, Zod schema, inferred-from-default).

The split mirrors the DI boundary: anything reachable through `RouteStateDeps` is tested directly against `core.ts`; only the auto-import wiring and Nuxt 3/4 build parity are left to the playgrounds, since those specifically test what `core.test.ts` cannot (real Nuxt module resolution).
