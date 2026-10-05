import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { customersApi } from '@/features/customers/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, capitalize } from '@/features/customers/utils.js'
import useOwners from '@/features/customers/useOwners.js'

export default function Customers() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { ownerName } = useOwners(orgId)

  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const notice = location.state?.notice

  const { data, error, loading, refreshing, reload } = useQuery(
    ['customers', orgId, { cursor, status }],
    ({ signal }) => customersApi.list(orgId, { limit: 25, cursor, status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const customers = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The businesses and people {activeOrg ? `“${activeOrg.name}”` : 'this company'} works for.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {hasAccess(me, ACCESS.manageCustomers) && <Link className="btn" to="/customers/new">+ New customer</Link>}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}

      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            resetPaging()
            setStatus(e.target.value)
          }}
        >
          <option value="">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>{capitalize(s)}</option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Code</th>
              <th>Type</th>
              <th>GSTIN</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No customers found.</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.legal_name && c.legal_name !== c.name && <div className="muted small">{c.legal_name}</div>}
                  </td>
                  <td className="mono">{c.code}</td>
                  <td>{CUSTOMER_TYPES[c.client_type] || c.client_type}</td>
                  <td className="mono">{c.gstin || <span className="muted">—</span>}</td>
                  <td>{ownerName(c.owner.id) || <span className="muted">—</span>}</td>
                  <td><StatusBadge status={c.status} /></td>
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
