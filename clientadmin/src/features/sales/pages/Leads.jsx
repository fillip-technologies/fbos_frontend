import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { leadsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import useOwners from '@/features/customers/useOwners.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { LEAD_SOURCES, LEAD_STATUSES, humanize } from '@/features/sales/utils.js'

const NO_FILTERS = { status: '', source: '' }

export default function Leads() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { ownerName } = useOwners(orgId)

  const [filters, setFilters] = useState(NO_FILTERS)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['leads', orgId, { cursor, filters }],
    ({ signal }) => leadsApi.list(orgId, { limit: 25, cursor, ...filters }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const leads = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }
  const setFilter = (k, v) => {
    resetPaging()
    setFilters((f) => ({ ...f, [k]: v }))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Enquiries for {activeOrg ? `“${activeOrg.name}”` : 'this company'}. Qualify them, then convert the good ones
            into a customer and an opportunity.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {hasAccess(me, ACCESS.manageLeads) && <Link className="btn" to="/leads/new">+ New lead</Link>}
        </div>
      </div>

      <div className="toolbar">
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
          <option value="">Any source</option>
          {Object.entries(LEAD_SOURCES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Company</th>
              <th>Source</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No leads found.</td></tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.contact_name}</div>
                    <div className="muted small">
                      <span className="mono">{l.code}</span>
                      {(l.contact_email || l.contact_phone) && ` · ${l.contact_email || l.contact_phone}`}
                    </div>
                  </td>
                  <td>{l.company_name || <span className="muted">—</span>}</td>
                  <td>{LEAD_SOURCES[l.source] || l.source || '—'}</td>
                  <td>{(l.owner && ownerName(l.owner.id)) || <span className="muted">—</span>}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td className="muted small">{formatDate(l.created_at.slice(0, 10))}</td>
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
