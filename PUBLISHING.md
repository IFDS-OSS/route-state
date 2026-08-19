# Publishing to npm

This publishes a single package: `@ifds/route-state`. There's no monorepo
here (unlike `hydration-lens`) — no dependency ordering, no other workspace
members to worry about. `playground/` and `playground-nuxt4/` are dev-only
apps that consume the package from source or from a locally vendored build;
neither is part of what gets published. `"files": ["dist"]` in
`package.json` means only built output ships — never `src/`, `test/`,
`playground*/`, or configs.

## One-time setup

```bash
npm login
```

Verify you're logged in as the right account/org member:

```bash
npm whoami
```

`@ifds/route-state` is scoped under the `ifds` npm organization. If this is
the very first publish of the package, the name is claimed on first
`npm publish` — no separate reservation step, as long as the `ifds` npm
organization already exists (create it at
https://www.npmjs.com/org/create if not, and make sure your npm account is
a member with publish rights).

**Scoped packages default to private on npm** — but this one is already
handled: `package.json` sets `"publishConfig": { "access": "public" }`, so
plain `npm publish` (no `--access public` flag needed) publishes it public.
Double-check that field is still there before publishing if it's ever been
touched — without it, `npm publish` on a scoped package either fails (no
private-package plan on the org) or silently creates a private package.

## ⚠️ Always publish from the repo root

Unlike `hydration-lens` (a pnpm monorepo where you `cd` into each package
directory), `route-state` **is** the package — its `package.json` lives at
the repo root. Run `npm pack --dry-run` / `npm publish` from
`.../route-state`, not from `playground/` or `playground-nuxt4/` (those
have their own, unrelated `package.json` files — `playground-nuxt4`'s is
a throwaway vendoring target written by `scripts/prepare-nuxt4.mjs`, not a
package to publish).

```bash
pwd   # should be .../route-state
```

## Pre-publish checks

Run the full verification suite once before publishing:

```bash
cd /home/berlin/Documents/Personal/route-state
npm install
npm run build       # unbuild → dist/
npm run typecheck   # vue-tsc --noEmit
npm run test        # vitest run
```

All should pass. Also sanity-check exactly what would be uploaded before
committing to publishing:

```bash
npm pack --dry-run
```

Confirm the file list is just `dist/**` and `package.json` (plus
`README.md`/`LICENSE` if present at the root) — nothing from `src/`,
`test/`, `playground/`, or `playground-nuxt4/` leaking in. If you see any
of those in the listing, stop and check `"files"` in `package.json` before
proceeding.

## Publish

`dist/` is a build artifact (gitignored), and `prepublishOnly` already runs
`npm run build` automatically on `npm publish` — but it's still worth
building explicitly first so the pre-publish `npm pack --dry-run` check
above reflects what will actually ship:

```bash
npm run build
npm publish
```

Since `publishConfig.access` is already `"public"` in `package.json`, no
`--access public` flag is required. If that field is ever removed, add
the flag back explicitly or the publish will fail/go private.

## Verify

```bash
npm view @ifds/route-state version
```

Then do a clean-room install smoke test, outside the repo, to confirm the
published tarball actually works standalone — not just via the local
`playground`'s workspace-style resolution:

```bash
mkdir -p /tmp/route-state-smoke && cd /tmp/route-state-smoke
npm init -y
npm install @ifds/route-state nuxt
node -e "require('@ifds/route-state')" # or check dist/module.mjs exports
```

For a closer-to-real check, the existing Nuxt 4 parity flow already does
most of this: `npm run prepare:nuxt4` vendors the local `dist/` into
`playground-nuxt4/node_modules/@ifds/route-state` and resolves its peer
deps (`nuxt/app`, `vue`, `vue-router`) from that app's own install — the
same path a real `npm i @ifds/route-state` consumer takes. A passing
`npm run build:nuxt4` after a fresh build is good parity evidence
alongside the registry smoke test above.

## Releasing a new version later

Bump `"version"` in `package.json`, then repeat the same
build → verify → publish sequence above. Tag the release in git so the
npm version and the GitHub tag stay in sync:

```bash
git tag v0.1.0
git push origin v0.1.0
```
