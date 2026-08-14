import { addImports, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: '@ifds/route-state',
    configKey: 'routeState',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const runtimeDir = resolve('./runtime')

    addImports([
      // composables
      { name: 'useRouteState', from: resolve('./runtime/composables/useRouteState') },
      { name: 'useRouteStates', from: resolve('./runtime/composables/useRouteStates') },
      // parser factories & built-ins (tree-shaken when unused)
      { name: 'arrayParser', from: resolve('./runtime/parsers/index') },
      { name: 'zodParser', from: resolve('./runtime/parsers/index') },
      { name: 'jsonParser', from: resolve('./runtime/parsers/index') },
      { name: 'dateParser', from: resolve('./runtime/parsers/index') },
      { name: 'integerParser', from: resolve('./runtime/parsers/index') },
      { name: 'floatParser', from: resolve('./runtime/parsers/index') },
      { name: 'booleanParser', from: resolve('./runtime/parsers/index') },
      { name: 'stringParser', from: resolve('./runtime/parsers/index') },
      { name: 'enumParser', from: resolve('./runtime/parsers/index') },
      { name: 'slugParser', from: resolve('./runtime/parsers/index') },
    ])

    // Transpile the runtime so source-level modules work from outside node_modules
    nuxt.options.build.transpile.push(runtimeDir)
  },
})
