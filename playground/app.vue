<script setup lang="ts">
const route = useRoute()

// persist: true — survives navigation to /other when carried in the query
const theme = useRouteState('theme', { default: 'light', persist: true })

const copyUrl = async () => {
  await navigator.clipboard.writeText(window.location.href)
  alert('URL copied — it encodes the current state!')
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto font-sans">
    <header class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">@ifds/route-state playground</h1>
        <p class="text-sm opacity-70">
          Every control below is backed by a query param. Share or bookmark the URL.
        </p>
      </div>
      <div class="flex gap-2">
        <NuxtLink to="/" class="px-3 py-1 rounded border">Home</NuxtLink>
        <NuxtLink
          :to="{ path: '/other', query: { theme: theme.value } }"
          class="px-3 py-1 rounded border"
        >
          /other (tests reset)
        </NuxtLink>
        <button class="px-3 py-1 rounded border" @click="copyUrl">Copy URL</button>
      </div>
    </header>

    <p class="text-xs font-mono break-all mb-6 opacity-80">?{{ route.query }}</p>

    <NuxtPage />
  </div>
</template>
