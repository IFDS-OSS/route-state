<script setup lang="ts">
// Same keys as the home page. `page` resets to its default when arriving here
// (param dropped), while `theme` (persist: true) survives because the link
// carried it in the query.
const page = useRouteState('page', { type: 'integer', default: 1 })
const theme = useRouteState('theme', { default: 'light', persist: true })

const bump = () => { page.value += 1 }
const cycleTheme = () => { theme.value = theme.value === 'light' ? 'dark' : 'light' }
</script>

<template>
  <main class="space-y-6">
    <h1 class="text-lg font-semibold">/other — route-change reset demo</h1>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">page (no persist — resets on path change)</h2>
      <div class="flex items-center gap-3">
        <button class="px-3 py-1 rounded border" @click="bump">page +1</button>
        <span>state: <code>{{ page }}</code></span>
      </div>
      <p class="text-xs mt-1 opacity-70">
        Navigate to Home and back with the browser buttons — this resets to 1
        whenever the route path changes.
      </p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">theme (persist: true — survives navigation)</h2>
      <div class="flex items-center gap-3">
        <button class="px-3 py-1 rounded border" @click="cycleTheme">toggle theme</button>
        <span>state: <code>{{ theme }}</code></span>
      </div>
      <p class="text-xs mt-1 opacity-70">
        The Home link carries <code>?theme=...</code> — with persist it is not
        stripped on path change.
      </p>
    </section>
  </main>
</template>
