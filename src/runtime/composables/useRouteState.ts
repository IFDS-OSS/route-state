import { getCurrentInstance, onMounted } from 'vue'
import { useNuxtApp, useRouter } from 'nuxt/app'
import { createRouteState } from '../core'
import type { RouteStateDeps, RouteStateEntry, UseRouteState } from '../core'

// One store per Nuxt app instance on the server (each request gets its own
// state — no cross-request leakage), a single module-level store on the client.
const clientStore = new Map<string, RouteStateEntry>()
const serverStores = new WeakMap<object, Map<string, RouteStateEntry>>()

function buildDeps(): RouteStateDeps {
  const nuxtApp = useNuxtApp()
  const router = useRouter()
  const instance = getCurrentInstance()
  const isClientSide = typeof window !== 'undefined'
  let store = isClientSide ? clientStore : serverStores.get(nuxtApp)
  if (!store) {
    store = new Map<string, RouteStateEntry>()
    if (!isClientSide) {
      serverStores.set(nuxtApp, store)
    }
  }
  return {
    router,
    store,
    onMounted: instance ? onMounted : undefined,
    isClient: isClientSide,
  }
}

/**
 * `useState` for the URL: a type-safe ref synced with a query parameter.
 *
 * ```ts
 * const page = useRouteState('page', { type: 'integer', default: 1 })
 * const q    = useRouteState('q', { default: '' })
 * page.value = 2 // → router.replace({ query: { ...route.query, page: '2' } })
 * ```
 */
export const useRouteState: UseRouteState = ((key: string, options?: any) => {
  return createRouteState(buildDeps())(key, options)
}) as UseRouteState
