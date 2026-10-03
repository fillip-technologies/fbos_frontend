import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { organizationsApi } from '../../api/client.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'

const PAGE_SIZE = 25

export default function OrganizationsList() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [page, setPage] = useState(null) // { next_cursor, has_more, limit }
  const [cursorStack, setCursorStack] = useState([]) // cursors for previous pages
  const [cursor, setCursor] = useState(null) // current page cursor
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (activeCursor) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await organizationsApi.list({ limit: PAGE_SIZE, cursor: activeCursor || undefined })
      setOrgs(resp.data || [])
      setPage(resp.page || null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(cursor)
  }, [cursor, load])

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
        <h1>Organizations</h1>
        <button className="btn" onClick={() => navigate('/organizations/new')}>
          + New organization
        </button>
      </div>

      <ErrorBanner error={error} onRetry={() => load(cursor)} />

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Email</th>
              <th>Currency</th>
              <th>Timezone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="center-note">Loading…</td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="center-note">
                  No organizations yet. Create the first one.
                </td>
              </tr>
            ) : (
              orgs.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/organizations/${o.id}`)}>
                  <td>{o.name}</td>
                  <td className="mono">{o.code || <span className="muted">—</span>}</td>
                  <td>{o.email}</td>
                  <td className="mono">{o.base_currency}</td>
                  <td>{o.timezone}</td>
                  <td>
                    <StatusBadge status={o.status} />
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
