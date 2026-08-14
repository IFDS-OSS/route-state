import { getCurrentInstance, onMounted } from 'vue'
import { useNuxtApp, useRouter } from 'nuxt/app'
import { createRouteStates } from '../core'
import type { RouteStateDeps, RouteStateEntry, UseRouteStates } from '../core'

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
 * Multi-key variant: manage several query params at once. Every write merges
 * all managed keys into a single router call (no stale-copy overwrites).
 *
 * ```ts
 * const { page, q, sort } = useRouteStates({
 *   page: { type: 'integer', default: 1 },
 *   q:    { default: '' },
 *   sort: { default: 'recent' },
 * })
 * page.value = 2 // → one router.replace merging { page, q, sort }
 * ```
 */
export const useRouteStates: UseRouteStates = ((states: Record<string, any>) => {
  return createRouteStates(buildDeps())(states)
}) as UseRouteStates
