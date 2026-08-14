import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // The module entry needs no generated .d.ts — Nuxt loads module.mjs, and
    // consumer types come from runtime/*.d.ts. Generating one drags @nuxt/kit
    // → vite → rollup types into the declaration graph and breaks the build;
    // a hand-written stub is copied instead.
    { input: 'src/module', declaration: false },
    { input: 'src', outDir: 'dist/', builder: 'copy', pattern: 'module.d.ts' },
    {
      input: 'src/runtime/',
      outDir: 'dist/runtime/',
      format: 'esm',
      declaration: true,
    },
  ],
  clean: true,
  failOnWarn: false,
  externals: ['#imports', 'nuxt', 'nuxt/app', '@nuxt/kit', 'vue', 'vue-router', 'zod'],
  rollup: {
    emitCJS: false,
  },
})
