import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '../../api/client.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'

const PAGE_SIZE = 25
const STATUS_FILTERS = ['active', 'invited', 'suspended', 'deactivated']

// The API returns naive UTC timestamps (no offset); mark them UTC before formatting.
function formatTimestamp(iso) {
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)
  return new Date(hasOffset ? iso : `${iso}Z`).toLocaleString()
}

// The backend scopes /users to the caller's own organization (from the token).
export default function Members() {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(null) // { next_cursor, has_more, limit }
  const [cursorStack, setCursorStack] = useState([]) // cursors for previous pages
  const [cursor, setCursor] = useState(null) // current page cursor
  const [search, setSearch] = useState('') // input value
  const [filters, setFilters] = useState({ q: '', status: '' }) // applied
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (activeCursor, activeFilters) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await usersApi.list({
        limit: PAGE_SIZE,
        cursor: activeCursor || undefined,
        q: activeFilters.q || undefined,
        status: activeFilters.status || undefined,
      })
      setUsers(resp.data || [])
      setPage(resp.page || null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(cursor, filters)
  }, [cursor, filters, load])

  function applyFilters(next) {
    setCursorStack([])
    setCursor(null)
    setFilters(next)
  }

  function nextPage() {
    if (!page?.has_more || !page?.next_cursor) return
    setCursorStack((s) => [...s, cursor])
    setCursor(page.next_cursor)
  }

  function prevPage() {
    setCursorStack((s) => {
      if (s.length === 0) return s
      const copy = [...s]
      const prev = copy.pop()
      setCursor(prev ?? null)
      return copy
    })
  }

  return (
    <div>
      <div className="page-head">
        <h1>Members</h1>
      </div>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          applyFilters({ ...filters, q: search.trim() })
        }}
      >
        <input
          type="search"
          placeholder="Search name, email or employee code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => applyFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn secondary" type="submit">
          Search
        </button>
      </form>

      <ErrorBanner error={error} onRetry={() => load(cursor, filters)} />

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="static">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="center-note">Loading…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="center-note">No members match.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.user_type.replace(/_/g, ' ')}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="mono">
                    {u.last_login_at ? formatTimestamp(u.last_login_at) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          onClick={prevPage}
          disabled={loading || cursorStack.length === 0}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          onClick={nextPage}
          disabled={loading || !page?.has_more}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
