export default defineNuxtConfig({
  // Load the module straight from source — no build step needed for development.
  // To test the published artifact instead: modules: ['../dist/module.mjs']
  modules: ['../src/module'],
  devtools: { enabled: true },
})
