import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { expenseCategoriesApi, expensesApi } from '@/features/finance/api.js'
import ExpenseForm from '@/features/finance/components/ExpenseForm.jsx'
import { APPROVAL_LABELS, money, PAYMENT_BADGE, PAYMENT_LABELS } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { invalidate, prefetch, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

const FILTER_KEYS = ['approval_status', 'payment_status', 'category_id', 'from', 'to', 'q']
const STATUS_TABS = [['', 'All'], ['pending_approval', 'Waiting for approval'], ['approved', 'Approved'], ['rejected', 'Rejected']]

// Operating expenses: rent, travel, marketing… newest first.
export default function Expenses() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  // The New menu opens this page with ?new=1.
  const creating = params.get('new') === '1'
  const setCreating = (open) => {
    const nextParams = new URLSearchParams(params)
    if (open) nextParams.set('new', '1')
    else nextParams.delete('new')
    setParams(nextParams, { replace: true })
  }

  const list = useQuery(
    ['finance-expenses', orgId, { cursor, filters }],
    ({ signal }) => expensesApi.list(orgId, { limit: 25, cursor, ...filters }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const categories = useLookup(['finance-categories', orgId], ({ signal }) => expenseCategoriesApi.list(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const rows = list.data?.data ?? []
  const next = list.data?.page?.has_more ? list.data.page.next_cursor : null
  const busy = list.loading || list.refreshing

  function setFilter(key, value) {
    setCursor(undefined)
    setStack([])
    const nextParams = new URLSearchParams(params)
    if (value) nextParams.set(key, value)
    else nextParams.delete(key)
    setParams(nextParams, { replace: true })
  }

  const warm = (id) => prefetch(['finance-expense', orgId, id], ({ signal }) => expensesApi.get(orgId, id, { signal }))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Expenses</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Rent, travel, marketing and other running costs of the company.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => { setCursor(undefined); setStack([]) }} />
          {hasAccess(user, ACCESS.manageExpenses) && <button className="btn" onClick={() => setCreating(true)}>+ Expense</button>}
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Approval" style={{ marginBottom: 12 }}>
        {STATUS_TABS.map(([key, label]) => (
          <button key={key || 'all'} type="button" className={filters.approval_status === key ? 'active' : ''} aria-pressed={filters.approval_status === key}
            onClick={() => setFilter('approval_status', key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <input type="search" placeholder="Search description or vendor" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Search" />
        <select value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.payment_status} onChange={(e) => setFilter('payment_status', e.target.value)} aria-label="Paid">
          <option value="">Paid or not</option>
          <option value="unpaid">Not paid</option>
          <option value="paid">Paid</option>
        </select>
        <label className="small muted">From <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} /></label>
        <label className="small muted">To <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} /></label>
      </div>

      <ErrorBanner error={list.error} onRetry={list.reload} />

      <div className={`panel${list.refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Expense</th><th>Category</th><th style={{ textAlign: 'right' }}>Total</th><th>Approval</th><th>Paid</th></tr>
          </thead>
          <tbody>
            {list.loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No expenses match. Record one with “+ Expense”.</td></tr>
            ) : (
              rows.map((x) => (
                <tr key={x.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/expenses/${x.id}`)} onMouseEnter={() => warm(x.id)}>
                  <td>{formatDate(x.expense_date)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{x.description}</div>
                    {x.vendor_name && <div className="muted small">{x.vendor_name}</div>}
                  </td>
                  <td>{x.category?.name}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{money(x.total, x.currency)}</td>
                  <td><StatusBadge status={x.approval_status} label={APPROVAL_LABELS[x.approval_status]} /></td>
                  <td><StatusBadge status={PAYMENT_BADGE[x.payment_status]} label={PAYMENT_LABELS[x.payment_status]} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn secondary" disabled={busy || stack.length === 0} onClick={() => { setCursor(stack[stack.length - 1]); setStack(stack.slice(0, -1)) }}>
          ← Previous
        </button>
        <button className="btn secondary" disabled={busy || !next} onClick={() => { setStack([...stack, cursor]); setCursor(next) }}>
          Next →
        </button>
      </div>

      {creating && (
        <ExpenseForm orgId={orgId} onClose={() => setCreating(false)}
          onSaved={(saved) => { invalidate(['finance-expenses', orgId]); navigate(`/expenses/${saved.id}`) }} />
      )}
    </div>
  )
}
