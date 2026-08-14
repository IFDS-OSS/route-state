<script setup lang="ts">
import { z } from 'zod'

// --- String with debounce (typing in the box coalesces into one URL write) ---
const q = useRouteState('q', { default: '', debounce: 200 })

// --- Integer, replace vs push (separate keys — each state owns its history mode) ---
const page = useRouteState('page', { type: 'integer', default: 1 })
const pagePush = useRouteState('pagePush', { type: 'integer', default: 1, history: 'push' })
const bumpReplace = () => { page.value += 1 }
const bumpPush = () => { pagePush.value += 1 }

// --- Float ---
const price = useRouteState('price', { type: 'float', default: 2.5 })

// --- Boolean (presence-based; explicit false/0 also parse) ---
const feature = useRouteState('feature', { type: 'boolean', default: false })

// --- Enum (string union) ---
const status = useRouteState('status', {
  parser: enumParser(['draft', 'published', 'archived'] as const),
  default: 'draft',
})

// --- Slug (type: 'slug', URL-safe lowercase) ---
const slug = useRouteState('slug', { type: 'slug', default: 'getting-started' })

// --- Date (ISO-8601 UTC) ---
const from = useRouteState('from', {
  type: 'date',
  default: new Date('2026-01-01T00:00:00.000Z'),
})
const onDateChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (value) from.value = new Date(`${value}T00:00:00.000Z`)
}

// --- Array via repeated params: ?tags=vue&tags=nuxt ---
const tags = useRouteState('tags', {
  parser: arrayParser(stringParser),
  default: ['vue', 'nuxt'],
})

// --- JSON object in a single encoded param ---
const filter = useRouteState('filter', {
  parser: jsonParser,
  default: { status: 'active', pageSize: 10 },
})
const filterText = computed({
  get: () => JSON.stringify(filter.value),
  set: (v) => {
    try {
      filter.value = JSON.parse(v)
    } catch {
      /* keep last valid value while typing */
    }
  },
})

// --- Zod schema (parse + validation + type inference) ---
const userSchema = z.object({
  name: z.string().min(2),
  age: z.number().int().min(0),
})
const user = useRouteState('user', {
  parser: zodParser(userSchema),
  default: { name: 'buffy', age: 1 },
})
// URL sync happens on whole-value replacement (the URL is a string, not an object)
const onUserName = (event: Event) => {
  user.value = { ...user.value, name: (event.target as HTMLInputElement).value }
}
const onUserAge = (event: Event) => {
  const age = Number((event.target as HTMLInputElement).value)
  user.value = { ...user.value, age }
}

// --- Multi-key group: one router call per change, all keys merged ---
const { sort, limit } = useRouteStates({
  sort: { default: 'recent' },
  limit: { type: 'integer', default: 20 },
})

const addTag = () => tags.value = [...tags.value, `tag${tags.value.length + 1}`]
const clearAll = () => {
  q.value = ''
  page.value = 1
  price.value = 2.5
  feature.value = false
  status.value = 'draft'
  slug.value = 'getting-started'
  from.value = new Date('2026-01-01T00:00:00.000Z')
  tags.value = []
  filter.value = { status: 'active', pageSize: 10 }
  user.value = { name: 'buffy', age: 1 }
  sort.value = 'recent'
  limit.value = 20
}
</script>

<template>
  <main class="space-y-8">
    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">String + debounce (200ms)</h2>
      <input v-model="q" class="border rounded px-2 py-1 w-64" placeholder="Search…" />
      <p class="text-xs mt-1 opacity-70">state: <code>{{ JSON.stringify(q) }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Integer — history modes</h2>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <button class="px-3 py-1 rounded border" @click="bumpReplace">page +1</button>
          <span><code>page</code> (replace): {{ page }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-3 py-1 rounded border" @click="bumpPush">pagePush +1</button>
          <span><code>pagePush</code> (push): {{ pagePush }}</span>
        </div>
      </div>
      <p class="text-xs mt-1 opacity-70">Try the browser back button after using <code>pagePush</code>.</p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Float</h2>
      <input v-model.number="price" type="number" step="0.1" class="border rounded px-2 py-1" />
      <p class="text-xs mt-1 opacity-70">state: <code>{{ price }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Boolean (presence-based)</h2>
      <label class="flex items-center gap-2">
        <input v-model="feature" type="checkbox" />
        feature flag
      </label>
      <p class="text-xs mt-1 opacity-70">state: <code>{{ feature }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Enum (string union)</h2>
      <select v-model="status" class="border rounded px-2 py-1">
        <option value="draft">draft</option>
        <option value="published">published</option>
        <option value="archived">archived</option>
      </select>
      <p class="text-xs mt-1 opacity-70">state: <code>{{ status }}</code> — anything else falls back to the default</p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Slug (type: 'slug')</h2>
      <input v-model="slug" class="border rounded px-2 py-1 w-64" placeholder="getting-started" />
      <p class="text-xs mt-1 opacity-70">state: <code>{{ slug }}</code> (invalid input resets to the default)</p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Date (ISO-8601 UTC)</h2>
      <input
        type="date"
        class="border rounded px-2 py-1"
        :value="from.toISOString().slice(0, 10)"
        @change="onDateChange"
      />
      <p class="text-xs mt-1 opacity-70">state: <code>{{ from.toISOString() }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Array (repeated params)</h2>
      <div class="flex items-center gap-2 flex-wrap">
        <button class="px-3 py-1 rounded border" @click="addTag">add tag</button>
        <span
          v-for="t in tags"
          :key="t"
          class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs"
        >{{ t }}</span>
      </div>
      <p class="text-xs mt-1 opacity-70">state: <code>{{ JSON.stringify(tags) }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">JSON object (single encoded param)</h2>
      <input v-model="filterText" class="border rounded px-2 py-1 w-96 font-mono text-xs" />
      <p class="text-xs mt-1 opacity-70">state: <code>{{ JSON.stringify(filter) }}</code></p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">Zod schema</h2>
      <div class="flex gap-2">
        <input
          class="border rounded px-2 py-1"
          placeholder="name (min 2 chars)"
          :value="user.name"
          @input="onUserName"
        />
        <input
          type="number"
          class="border rounded px-2 py-1 w-24"
          placeholder="age"
          :value="user.age"
          @input="onUserAge"
        />
      </div>
      <p class="text-xs mt-1 opacity-70">
        state: <code>{{ JSON.stringify(user) }}</code>
        (invalid values fall back to the default + dev warning)
      </p>
    </section>

    <section class="p-4 rounded border">
      <h2 class="font-semibold mb-2">useRouteStates (grouped, one router call per change)</h2>
      <div class="flex gap-4 text-sm">
        <label>
          sort
          <select v-model="sort" class="border rounded px-2 py-1 ml-1">
            <option>recent</option>
            <option>oldest</option>
            <option>popular</option>
          </select>
        </label>
        <label>
          limit
          <input v-model.number="limit" type="number" min="1" class="border rounded px-2 py-1 ml-1 w-24" />
        </label>
      </div>
    </section>

    <button class="px-4 py-2 rounded bg-red-500 text-white" @click="clearAll">Reset everything</button>
  </main>
</template>
