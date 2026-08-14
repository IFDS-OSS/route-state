export default defineNuxtConfig({
  // The module is resolved by name from this app's own node_modules —
  // `npm i @ifds/route-state` in a real Nuxt 4 app behaves exactly this way.
  // (Vendored by `bun run prepare:nuxt4`, which builds dist and copies it in.)
  modules: ['@ifds/route-state'],
  devtools: { enabled: true },
})
