import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { invoicesApi } from '@/features/billing/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { prefetch, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { DOC_TYPES, isPastDue } from '@/features/billing/utils.js'

const TABS = [
  ['', 'All'],
  ['draft', 'Drafts'],
  ['issued', 'Issued'],
  ['partially_paid', 'Part paid'],
  ['overdue', 'Overdue'],
  ['paid', 'Paid'],
]

export default function Invoices() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  const { data, error, loading, refreshing, reload } = useQuery(
    ['invoices', orgId, { status, cursor }],
    ({ signal }) => invoicesApi.list(orgId, { limit: 25, cursor, status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const invoices = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  // Resting on a row for a moment starts loading the invoice, so the detail page usually
  // opens at once. Sweeping the mouse across the list fetches nothing.
  const hoverTimer = useRef()
  const prefetchInvoice = (id) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(
      () => prefetch(['invoice', orgId, id], ({ signal }) => invoicesApi.get(orgId, id, { signal })),
      150
    )
  }

  function resetPaging() {
    setCursor(undefined)
    setStack([])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Tax invoices and credit notes of {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={resetPaging} />
          {hasAccess(me, ACCESS.manageInvoices) && <Link className="btn" to="/invoices/new">+ New invoice</Link>}
        </div>
      </div>

      <div className="version-tabs">
        {TABS.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            className={`version-tab${status === value ? ' active' : ''}`}
            onClick={() => {
              resetPaging()
              setStatus(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Issued</th>
              <th>Due</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No invoices found.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} onMouseEnter={() => prefetchInvoice(inv.id)} onMouseLeave={() => clearTimeout(hoverTimer.current)}>
                  <td>
                    <div className="mono">{inv.invoice_no || <span className="muted">Draft</span>}</div>
                    {inv.doc_type !== 'tax_invoice' && <div className="muted small">{DOC_TYPES[inv.doc_type]}</div>}
                  </td>
                  <td>{inv.client.name}</td>
                  <td>{formatDate(inv.issue_date)}</td>
                  <td>
                    {formatDate(inv.due_date)}
                    {isPastDue(inv) && inv.status !== 'overdue' && <div><span className="badge expired">past due</span></div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(inv.totals.grand_total)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(inv.balance_due)}</td>
                  <td><StatusBadge status={inv.status} /></td>
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
