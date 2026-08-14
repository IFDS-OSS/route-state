/**
 * Prepares the Nuxt 4 parity playground:
 *   1. builds the module into dist/ (unbuild),
 *   2. vendors the build into `playground-nuxt4/node_modules/@ifds/route-state`
 *      so bare imports ('nuxt/app', 'vue', 'vue-router', '@nuxt/kit') resolve
 *      against the app's OWN Nuxt 4 install — exactly like a real `npm i`.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dest = resolve(root, 'playground-nuxt4/node_modules/@ifds/route-state')

console.log('▸ building dist/ …')
execSync('node node_modules/unbuild/dist/cli.mjs', { cwd: root, stdio: 'inherit' })

console.log(`▸ vendoring dist → ${dest.replace(root, '.')}/`)
rmSync(dest, { recursive: true, force: true })
mkdirSync(`${dest}/dist`, { recursive: true })
cpSync(resolve(root, 'dist'), `${dest}/dist`, { recursive: true })
writeFileSync(
  `${dest}/package.json`,
  JSON.stringify(
    {
      name: '@ifds/route-state',
      version: '0.1.0',
      type: 'module',
      main: './dist/module.mjs',
      exports: {
        '.': './dist/module.mjs',
        './parsers': './dist/runtime/parsers/index.mjs',
      },
      dependencies: { '@nuxt/kit': '^3.13.0' },
    },
    null,
    2,
  ),
)

console.log('✔ playground-nuxt4 ready — run: bun run build:nuxt4')
