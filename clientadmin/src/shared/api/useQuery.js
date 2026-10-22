import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { isAbortError } from '@/shared/api/http.js'
import { onSessionChange } from '@/shared/api/session.js'

// A small read cache over the API modules: one entry per query key.
//
//   const { data, error, loading, refreshing, reload, setData } = useQuery(
//     ['invoices', orgId, { status, cursor }],
//     ({ signal }) => invoicesApi.list(orgId, { limit: 25, status, cursor }, { signal }),
//     { enabled: Boolean(orgId), keepPrevious: true },
//   )
//
// - Keys are arrays, by convention [resource, orgId, ...params]; they are compared as JSON.
// - Cached data is shown at once. Data older than `staleTime` is refetched in the
//   background (stale-while-revalidate) while the cached rows stay usable.
// - Components asking for the same key share one request. The request is aborted once
//   nobody is waiting for it any more (page left, filters changed).
// - `keepPrevious` keeps the last rows on screen while the next page / tab / filter loads,
//   marked `refreshing` (dim them, don't page from them), but only within one resource
//   and organization, so another org's data never shows.
// - After a write: `setData(saved)` when the response is the new record, or
//   `invalidate(['invoices', orgId])` to refetch everything under that prefix.
// - Signing out (here or in another tab) empties the cache.

const DEFAULT_STALE_MS = 30_000
const UNUSED_ENTRY_TTL_MS = 5 * 60_000

const cache = new Map()

function entryFor(hash, key) {
  let entry = cache.get(hash)
  if (!entry) {
    entry = {
      key,
      data: undefined,
      error: null,
      updatedAt: 0,
      promise: null,
      controller: null,
      fetcher: null,
      users: 0,
      version: 0,
      listeners: new Set(),
      gcTimer: null,
    }
    cache.set(hash, entry)
  }
  return entry
}

function notify(entry) {
  entry.version += 1
  for (const fn of entry.listeners) fn()
}

function isFresh(entry, staleTime) {
  return entry.data !== undefined && !entry.error && Date.now() - entry.updatedAt < staleTime
}

// Starts a request for the entry unless one is already running.
function run(entry) {
  if (entry.promise) return entry.promise
  const controller = new AbortController()
  entry.controller = controller
  entry.error = null // a retry shows the skeleton (or the stale rows), not the old error
  const promise = Promise.resolve()
    .then(() => entry.fetcher({ signal: controller.signal }))
    .then(
      (data) => {
        if (entry.promise !== promise) return
        entry.data = data
        entry.error = null
        entry.updatedAt = Date.now()
      },
      (err) => {
        if (entry.promise !== promise || isAbortError(err)) return
        entry.error = err
      }
    )
    .finally(() => {
      if (entry.promise !== promise) return
      entry.promise = null
      entry.controller = null
      notify(entry)
    })
  entry.promise = promise
  notify(entry)
  return promise
}

function cancel(entry) {
  if (!entry.promise) return
  entry.controller?.abort()
  entry.promise = null
  entry.controller = null
}

function release(hash, entry) {
  entry.users -= 1
  if (entry.users > 0) return
  // Deferred: StrictMode (and a quick remount) releases and re-acquires in the same tick.
  setTimeout(() => {
    if (entry.users > 0) return
    cancel(entry)
    clearTimeout(entry.gcTimer)
    entry.gcTimer = setTimeout(() => {
      if (entry.users === 0 && cache.get(hash) === entry) cache.delete(hash)
    }, UNUSED_ENTRY_TTL_MS)
  }, 0)
}

function startsWith(key, prefix) {
  return prefix.every((part, i) => JSON.stringify(part) === JSON.stringify(key[i]))
}

// Marks every entry under `prefix` stale; the ones on screen refetch now.
export function invalidate(prefix) {
  for (const entry of cache.values()) {
    if (!startsWith(entry.key, prefix)) continue
    entry.updatedAt = 0
    if (entry.users > 0 && entry.fetcher) {
      cancel(entry)
      run(entry)
    }
  }
}

// Fetches ahead of need (e.g. a detail record on row hover), unless it is cached and fresh.
export function prefetch(key, fetcher, { staleTime = DEFAULT_STALE_MS } = {}) {
  const entry = entryFor(JSON.stringify(key), key)
  if (isFresh(entry, staleTime) || entry.promise) return
  entry.fetcher = fetcher
  run(entry).catch(() => {})
}

export function clearCache() {
  for (const entry of cache.values()) {
    cancel(entry)
    clearTimeout(entry.gcTimer)
  }
  cache.clear()
}

// A new sign-in may be another user: nothing cached may carry over.
onSessionChange((event) => {
  if (event.type === 'logout' || event.type === 'login') clearCache()
})

export function useQuery(key, fetcher, { enabled = true, staleTime = DEFAULT_STALE_MS, keepPrevious = false } = {}) {
  const hash = enabled ? JSON.stringify(key) : null
  const entry = hash ? entryFor(hash, key) : null
  if (entry) entry.fetcher = fetcher // always the latest closure

  const subscribe = useCallback(
    (onChange) => {
      if (!entry) return () => {}
      entry.listeners.add(onChange)
      return () => entry.listeners.delete(onChange)
    },
    [entry]
  )
  useSyncExternalStore(subscribe, () => entry?.version ?? -1)

  useEffect(() => {
    if (!entry) return undefined
    entry.users += 1
    clearTimeout(entry.gcTimer)
    if (!isFresh(entry, staleTime)) run(entry).catch(() => {})
    return () => release(hash, entry)
  }, [hash, entry, staleTime])

  // Last data shown, so the next key can keep it on screen while it loads.
  const shown = useRef({ scope: null, data: undefined })
  const scope = JSON.stringify(key.slice(0, 2))
  let data = entry?.data
  let previous = false
  if (data !== undefined) {
    shown.current = { scope, data }
  } else if (keepPrevious && shown.current.scope === scope && !entry?.error) {
    data = shown.current.data
    previous = data !== undefined
  }

  const reload = useCallback(() => {
    if (!entry) return Promise.resolve()
    cancel(entry)
    return run(entry)
  }, [entry])

  const setData = useCallback(
    (next) => {
      if (!entry) return
      entry.data = typeof next === 'function' ? next(entry.data) : next
      entry.error = null
      entry.updatedAt = Date.now()
      notify(entry)
    },
    [entry]
  )

  const error = entry?.error ?? null
  const fetching = Boolean(entry?.promise)
  return {
    data,
    error,
    // Nothing to show yet (also while disabled, e.g. waiting for the organization).
    loading: data === undefined && !error,
    // The rows on screen belong to the previous key (another page / tab / filter) while
    // this one loads: dim them and don't page from them. A background check of cached
    // data is not "refreshing": its rows stay usable, and TopProgress shows the request.
    refreshing: previous,
    // Any request for this key in flight, including a background check.
    fetching,
    reload,
    setData,
  }
}

// Catalogs that rarely change (offerings, units, roles, providers): cached for 5 minutes.
export function useLookup(key, fetcher, options) {
  return useQuery(key, fetcher, { staleTime: 5 * 60_000, ...options })
}
