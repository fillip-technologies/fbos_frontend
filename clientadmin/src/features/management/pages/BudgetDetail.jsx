import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { budgetsApi } from '@/features/management/api.js'
import { BUDGET_STATUS_LABELS, money, percent } from '@/features/management/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

export default function BudgetDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(user, ACCESS.manageBudgets)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')

  const budget = useQuery(['mgmt-budget', orgId, id], ({ signal }) => budgetsApi.get(orgId, id, { signal }), { enabled: Boolean(orgId) })
  const variance = useQuery(['mgmt-variance', orgId, id], ({ signal }) => budgetsApi.variance(orgId, id, { signal }), {
    enabled: Boolean(orgId && budget.data?.status === 'approved'),
  })
  const b = budget.data

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      invalidate(['mgmt-budget', orgId, id])
      invalidate(['mgmt-variance', orgId, id])
      invalidate(['mgmt-budgets', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const addLine = (e) => {
    e.preventDefault()
    run(async () => {
      await budgetsApi.addLine(orgId, id, { category: category.trim(), planned_amount: Number(amount) })
      setCategory('')
      setAmount('')
    })
  }

  if (budget.loading && !b) return <DetailSkeleton />
  if (!b) return <ErrorBanner error={budget.error} onRetry={budget.reload} />
  const isDraft = b.status === 'draft'
  const fields = getFieldErrors(error)

  return (
    <div>
      <p className="small"><Link to="/budgets">← Budgets</Link></p>
      <div className="page-head">
        <div>
          <h1>{b.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{b.code}</span> · {b.fiscal_year?.code} · revision {b.revision_no} · {b.currency}{' '}
            <StatusBadge status={b.status} label={BUDGET_STATUS_LABELS[b.status]} />
          </p>
        </div>
        {canManage && (
          <div className="row-actions">
            {isDraft && <button className="btn" disabled={busy || b.lines.length === 0} onClick={() => run(() => budgetsApi.submit(orgId, id))}>Send for approval</button>}
            {b.status === 'approved' && <button className="btn secondary" disabled={busy} onClick={() => run(() => budgetsApi.revise(orgId, id))}>Revise</button>}
          </div>
        )}
      </div>
      {b.status === 'pending_approval' && (
        <div className="alert">Waiting for a decision in Control. It shows here once someone who can read approvals has opened it.</div>
      )}
      <ErrorBanner error={error} />

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Category</th><th>Planned</th><th>Approved</th><th>Allocated</th><th>Spent</th></tr></thead>
          <tbody>
            {b.lines.length === 0 ? <tr><td colSpan={5} className="center-note">No lines yet.</td></tr> : b.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.category}{l.description && <div className="muted small">{l.description}</div>}</td>
                <td>{money(l.planned_amount, b.currency)}</td>
                <td>{money(l.approved_amount, b.currency)}</td>
                <td>{money(l.allocated_amount, b.currency)}</td>
                <td>{money(l.actual_amount, b.currency)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td><td>{money(b.totals.planned, b.currency)}</td><td>{money(b.totals.approved, b.currency)}</td><td /><td>{money(b.totals.actual, b.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {canManage && isDraft && (
        <form className="panel" onSubmit={addLine} style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="l-cat">Category</label>
            <input id="l-cat" value={category} onChange={(e) => setCategory(e.target.value)} required />
            {fields.category && <div className="field-error">{fields.category}</div>}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="l-amt">Planned amount</label>
            <input id="l-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <button className="btn" disabled={busy}>Add line</button>
        </form>
      )}

      {variance.data && (
        <>
          <h2 style={{ marginTop: 24 }}>Against budget</h2>
          {variance.data.unpriced_bookings > 0 && (
            <div className="alert">{variance.data.unpriced_bookings} booking(s) have no cost rate yet, so committed money is understated.</div>
          )}
          <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Category</th><th>Approved</th><th>Spent</th><th>Committed</th><th>Available</th><th>Variance</th><th>Last year</th></tr></thead>
              <tbody>
                {[...variance.data.lines, { ...variance.data.totals, category: 'Total' }].map((l) => (
                  <tr key={l.budget_line_id || 'total'}>
                    <td>{l.category}</td>
                    <td>{money(l.approved, b.currency)}</td>
                    <td>{money(l.actual, b.currency)}</td>
                    <td>{money(l.committed, b.currency)}</td>
                    <td>{money(l.available, b.currency)}</td>
                    <td>{money(l.variance_abs, b.currency)} <span className="muted small">{percent(l.variance_pct)}</span></td>
                    <td>{money(l.last_year_actual, b.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
