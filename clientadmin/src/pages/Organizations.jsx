import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { organizationsApi } from '../api/client.js'
import ErrorBanner from '../components/ErrorBanner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatFiscalYearStart } from '../utils/format.js'

export default function Organizations() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load(c) {
    setLoading(true)
    setError(null)
    organizationsApi
      .list({ limit: 25, cursor: c })
      .then((res) => {
        setOrgs(res.data)
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }
  useEffect(() => load(cursor), [cursor])

  return (
    <div>
      <div className="page-head">
        <h1>Organizations</h1>
        <Link className="btn" to="/organizations/new">
          New organization
        </Link>
      </div>
      <ErrorBanner error={error} onRetry={() => load(cursor)} />
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Currency</th>
              <th>Fiscal year starts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="center-note">Loading…</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={5} className="center-note">No organizations yet.</td></tr>
            ) : (
              orgs.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/organizations/${o.id}`)}>
                  <td>{o.name}</td>
                  <td className="mono">{o.code}</td>
                  <td>{o.base_currency}</td>
                  <td>{formatFiscalYearStart(o.fiscal_year_start)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || stack.length === 0}
          onClick={() => {
            const prev = stack[stack.length - 1]
            setStack(stack.slice(0, -1))
            setCursor(prev)
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
