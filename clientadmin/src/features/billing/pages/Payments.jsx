import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { paymentsApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { PAYMENT_METHODS, amountOf } from '@/features/billing/utils.js'

export default function Payments() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const [unallocatedOnly, setUnallocatedOnly] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['payments', orgId, { cursor, unallocatedOnly }],
    ({ signal }) => paymentsApi.list(orgId, { limit: 25, cursor, unallocated: unallocatedOnly ? 'true' : '' }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const payments = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Money received by {activeOrg ? `“${activeOrg.name}”` : 'this company'} and the invoices it settled.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {hasAccess(me, ACCESS.recordPayments) && <Link className="btn" to="/payments/new">+ Record payment</Link>}
        </div>
      </div>

      <div className="toolbar">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={unallocatedOnly}
            onChange={(e) => {
              resetPaging()
              setUnallocatedOnly(e.target.checked)
            }}
          />
          Only with unallocated money
        </label>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Customer</th>
              <th>Received</th>
              <th>Method</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Unallocated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : payments.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No payments found.</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/payments/${p.id}`)}>
                  <td className="mono">{p.code}</td>
                  <td>{p.client.name}</td>
                  <td>{formatDate(p.received_on)}</td>
                  <td>{PAYMENT_METHODS[p.method] || p.method}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(p.amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {amountOf(p.unallocated_amount) > 0 ? formatMoney(p.unallocated_amount) : <span className="muted">—</span>}
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
