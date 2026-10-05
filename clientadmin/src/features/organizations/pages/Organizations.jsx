import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { organizationsApi } from '@/features/organizations/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatFiscalYearStart } from '@/shared/utils/format.js'

export default function Organizations() {
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['organizations', null, { cursor }],
    ({ signal }) => organizationsApi.list({ limit: 25, cursor }, { signal }),
    { keepPrevious: true }
  )
  const orgs = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  return (
    <div>
      <div className="page-head">
        <h1>Companies</h1>
        <Link className="btn" to="/organizations/new">
          New organization
        </Link>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
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
              <TableSkeleton cols={5} />
            ) : orgs.length === 0 ? (
              <tr><td colSpan={5} className="center-note">No companies yet.</td></tr>
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
          disabled={loading || refreshing || stack.length === 0}
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
          disabled={loading || refreshing || !next}
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
