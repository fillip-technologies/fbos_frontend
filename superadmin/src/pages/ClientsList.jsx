import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi } from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'

const PAGE_SIZE = 25

export default function ClientsList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [page, setPage] = useState(null) // { next_cursor, has_more, limit }
  const [cursorStack, setCursorStack] = useState([]) // cursors for previous pages
  const [cursor, setCursor] = useState(null) // current page cursor
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (activeCursor) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await clientsApi.list({ limit: PAGE_SIZE, cursor: activeCursor || undefined })
      setClients(resp.data || [])
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
        <h1>Clients</h1>
        <button className="btn" onClick={() => navigate('/clients/new')}>
          + New client
        </button>
      </div>

      <ErrorBanner error={error} onRetry={() => load(cursor)} />

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Contact email</th>
              <th>Orgs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="center-note">Loading…</td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="center-note">
                  No clients yet. Create the first one.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                  <td>{c.name}</td>
                  <td className="mono">{c.code}</td>
                  <td>{c.contact_email || <span className="muted">—</span>}</td>
                  <td className="mono">
                    {typeof c.active_organizations_count === 'number'
                      ? `${c.active_organizations_count} / ${c.max_organizations}`
                      : c.max_organizations ?? <span className="muted">—</span>}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
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
