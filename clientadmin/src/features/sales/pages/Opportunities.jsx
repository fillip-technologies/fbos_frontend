import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { opportunitiesApi } from '@/features/sales/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { formatMoney } from '@/features/customers/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { STAGES, humanize } from '@/features/sales/utils.js'

export default function Opportunities() {
  const navigate = useNavigate()
  const { orgId, activeOrg } = useActiveOrg()
  const { ownerName } = useOwners(orgId)

  const [stage, setStage] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['opportunities', orgId, { cursor, stage }],
    ({ signal }) => opportunitiesApi.list(orgId, { limit: 25, cursor, stage }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const opportunities = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Opportunities</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Deals in progress for {activeOrg ? `“${activeOrg.name}”` : 'this company'}. They come from converted leads and
            are won when the customer accepts a quotation.
          </p>
        </div>
        <OrgSwitcher onChange={resetPaging} />
      </div>

      <div className="version-tabs">
        {['', ...STAGES].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`version-tab${stage === s ? ' active' : ''}`}
            onClick={() => {
              resetPaging()
              setStage(s)
            }}
          >
            {s ? humanize(s) : 'All'}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Customer</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Close by</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : opportunities.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No opportunities found.</td></tr>
            ) : (
              opportunities.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="muted small mono">{o.code}</div>
                  </td>
                  <td>{o.client.name}</td>
                  <td>
                    <StatusBadge status={o.stage} />
                    <div className="muted small">{o.probability}%</div>
                  </td>
                  <td>{formatMoney(o.expected_value)}</td>
                  <td>{formatDate(o.expected_close_date)}</td>
                  <td>{ownerName(o.owner.id) || <span className="muted">—</span>}</td>
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
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
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
