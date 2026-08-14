import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { createRouteState, createRouteStates } from '../src/runtime/core'
import type { RouteStateDeps, RouteStateEntry } from '../src/runtime/core'
import { arrayParser, stringParser } from '../src/runtime/parsers'

interface TestContext {
  router: Router
  store: Map<string, RouteStateEntry>
  mounted: Array<() => void>
  deps: RouteStateDeps
}

async function setup(): Promise<TestContext> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/other', component: { template: '<div />' } },
    ],
  })
  const mounted: Array<() => void> = []
  const store = new Map<string, RouteStateEntry>()
  const deps: RouteStateDeps = {
    router,
    store,
    onMounted: (fn) => mounted.push(fn),
    isClient: true,
    isDev: true,
  }
  await router.push('/')
  await router.isReady()
  return { router, store, mounted, deps }
}

/** Let router navigations and watchers settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

let ctx: TestContext

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function fresh(): Promise<TestContext> {
  ctx = await setup()
  return ctx
}

describe('writes', () => {
  it('writes a value to the URL query', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 5
    await settle()
    expect(router.currentRoute.value.query.page).toBe('5')
  })

  it('defaults to replace (no history entry)', async () => {
    const { router, deps } = await fresh()
    const replaceSpy = vi.spyOn(router, 'replace')
    const pushSpy = vi.spyOn(router, 'push')
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 5
    await settle()
    expect(replaceSpy).toHaveBeenCalledOnce()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('pushes a history entry when history: "push"', async () => {
    const { router, deps } = await fresh()
    const replaceSpy = vi.spyOn(router, 'replace')
    const pushSpy = vi.spyOn(router, 'push')
    const page = createRouteState(deps)('page', { type: 'integer', default: 1, history: 'push' })
    page.value = 5
    await settle()
    expect(pushSpy).toHaveBeenCalledOnce()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('merges with existing query params instead of overwriting them', async () => {
    const { router, deps } = await fresh()
    await router.replace({ query: { untouched: 'yes' } })
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 2
    await settle()
    expect(router.currentRoute.value.query).toEqual({ untouched: 'yes', page: '2' })
  })

  it('does not navigate when the serialized value already matches the URL', async () => {
    const { router, deps } = await fresh()
    await router.replace({ query: { page: '2' } })
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 2
    await settle()
    expect(router.currentRoute.value.query.page).toBe('2')
  })
})

describe('history / back / forward', () => {
  it('updates state when the query changes via router (back/forward)', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 2
    await settle()
    await router.push({ query: { page: '9' } })
    await settle()
    expect(page.value).toBe(9)

    await router.back()
    await settle()
    expect(page.value).toBe(2)

    await router.forward()
    await settle()
    expect(page.value).toBe(9)
  })

  it('parses values from the URL on external navigation', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    await router.replace({ query: { page: '7' } })
    await settle()
    expect(page.value).toBe(7)
  })
})

describe('defaults & edge cases', () => {
  it('uses the default when the param is absent', async () => {
    const { deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    expect(page.value).toBe(1)
  })

  it('falls back to the default with a dev warning on malformed values', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    await router.replace({ query: { page: 'abc' } })
    await settle()
    expect(page.value).toBe(1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('treats an empty string as absent → default', async () => {
    const { router, deps } = await fresh()
    const q = createRouteState(deps)('q', { default: 'all' })
    await router.replace({ query: { q: '' } })
    await settle()
    expect(q.value).toBe('all')
  })

  it('warns (dev) when a scalar parser receives multiple values', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    await router.replace({ query: { page: ['3', '4'] } })
    await settle()
    expect(page.value).toBe(3) // first value wins
    expect(warn).toHaveBeenCalledOnce()
  })

  it('does not warn in production mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { router, deps } = await fresh()
    deps.isDev = false
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    await router.replace({ query: { page: 'abc' } })
    await settle()
    expect(page.value).toBe(1)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('clearing', () => {
  it('removes the param when set to undefined (clear: remove)', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 5
    await settle()
    page.value = undefined as unknown as number
    await settle()
    expect('page' in router.currentRoute.value.query).toBe(false)
  })

  it('keeps an empty param when clear: "empty"', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1, clear: 'empty' })
    page.value = undefined as unknown as number
    await settle()
    expect(router.currentRoute.value.query.page).toBe('')
  })

  it('clears an empty array (treated as absent)', async () => {
    const { router, deps } = await fresh()
    const tags = createRouteState(deps)('tags', {
      parser: arrayParser(stringParser),
      default: ['a'],
    })
    tags.value = ['x', 'y']
    await settle()
    expect(router.currentRoute.value.query.tags).toEqual(['x', 'y'])
    tags.value = []
    await settle()
    expect('tags' in router.currentRoute.value.query).toBe(false)
  })
})

describe('hydration', () => {
  it('applies URL values to the shared ref after mount', async () => {
    const { router, mounted, deps } = await fresh()
    await router.replace({ query: { page: '4' } })
    createRouteState(deps)('page', { type: 'integer', default: 1 })
    expect(mounted.length).toBeGreaterThan(0)
    mounted.forEach((fn) => fn())
    expect((deps.store?.get('page') as RouteStateEntry<number>).ref.value).toBe(4)
  })

  it('hydrates only once even with multiple call sites', async () => {
    const { router, mounted, deps } = await fresh()
    await router.replace({ query: { page: '4' } })
    createRouteState(deps)('page', { type: 'integer', default: 1 })
    createRouteState(deps)('page', { type: 'integer', default: 1 })
    mounted.forEach((fn) => fn())
    mounted.forEach((fn) => fn())
    expect((deps.store?.get('page') as RouteStateEntry<number>).ref.value).toBe(4)
  })
})

describe('route changes', () => {
  it('resets non-persist state on route.path change', async () => {
    const { router, deps } = await fresh()
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    page.value = 5
    await settle()
    await router.push({ path: '/other', query: { page: '5' } })
    await settle()
    expect(page.value).toBe(1)
    expect('page' in router.currentRoute.value.query).toBe(false)
  })

  it('keeps persist: true state across route.path changes', async () => {
    const { router, deps } = await fresh()
    const theme = createRouteState(deps)('theme', { default: 'light', persist: true })
    theme.value = 'dark'
    await settle()
    await router.push({ path: '/other', query: { theme: 'dark' } })
    await settle()
    expect(theme.value).toBe('dark')
    expect(router.currentRoute.value.query.theme).toBe('dark')
  })
})

describe('debounce', () => {
  it('coalesces rapid writes into a single navigation after the pause', async () => {
    const { router, deps } = await fresh()
    const q = createRouteState(deps)('q', { default: '', debounce: 50 })

    vi.useFakeTimers()
    q.value = 'a'
    q.value = 'ab'
    q.value = 'abc'
    expect(router.currentRoute.value.query.q).toBeUndefined()

    await vi.advanceTimersByTimeAsync(49)
    expect(router.currentRoute.value.query.q).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1) // fires the debounce timer + flushes navigation
    expect(router.currentRoute.value.query.q).toBe('abc')
  })
})

describe('sharing & multi-key', () => {
  it('shares the same underlying ref across call sites', async () => {
    const { deps } = await fresh()
    const a = createRouteState(deps)('page', { type: 'integer', default: 1 })
    const b = createRouteState(deps)('page', { type: 'integer', default: 1 })
    expect(a).toBe(b)
  })

  it('warns on conflicting defaults for a shared key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = await fresh()
    createRouteState(deps)('page', { type: 'integer', default: 1 })
    createRouteState(deps)('page', { type: 'integer', default: 99 })
    expect(warn).toHaveBeenCalledOnce()
  })

  it('writes all group keys in one router call (useRouteStates)', async () => {
    const { router, deps } = await fresh()
    const states = createRouteStates(deps)({
      page: { type: 'integer', default: 1 },
      q: { default: '' },
      sort: { default: 'recent' },
    })
    states.page.value = 2
    await settle()
    // q serializes to null (empty string → absent) and is removed by the group write
    expect(router.currentRoute.value.query).toEqual({ page: '2', sort: 'recent' })
  })

  it('useRouteStates shares refs with useRouteState for the same key', async () => {
    const { deps } = await fresh()
    const single = createRouteState(deps)('page', { type: 'integer', default: 1 })
    const multi = createRouteStates(deps)({ page: { type: 'integer', default: 1 } })
    expect(single).toBe(multi.page)
  })
})

describe('non-component context', () => {
  it('returns a local ref with a dev warning when not in a component setup', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    const deps: RouteStateDeps = { router, isClient: true, isDev: true } // no onMounted
    const page = createRouteState(deps)('page', { type: 'integer', default: 1 })
    expect(page.value).toBe(1)
    page.value = 5
    expect(router.currentRoute.value.query.page).toBeUndefined() // no URL sync
    expect(warn).toHaveBeenCalledOnce()
  })
})
