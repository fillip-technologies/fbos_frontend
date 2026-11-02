import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { budgetsApi, planningApi } from '@/features/management/api.js'
import { BUDGET_STATUS_LABELS, money } from '@/features/management/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, prefetch, useLookup, useQuery } from '@/shared/api/useQuery.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

export default function Budgets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const [creating, setCreating] = useState(false)
  const list = useQuery(['mgmt-budgets', orgId], ({ signal }) => budgetsApi.list(orgId, { limit: 100 }, { signal }), { enabled: Boolean(orgId) })
  const budgets = list.data?.data ?? []
  const warm = (id) => prefetch(['mgmt-budget', orgId, id], ({ signal }) => budgetsApi.get(orgId, id, { signal }))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>What was planned, approved and spent, per fiscal year.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {hasAccess(user, ACCESS.manageBudgets) && <button className="btn" onClick={() => setCreating(true)}>+ Budget</button>}
        </div>
      </div>
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Budget</th><th>Fiscal year</th><th>Revision</th><th>Planned</th><th>Approved</th><th>Spent</th><th>Status</th></tr></thead>
          <tbody>
            {list.loading ? <TableSkeleton cols={7} /> : budgets.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No budgets yet.</td></tr>
            ) : (
              budgets.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/budgets/${b.id}`)} onMouseEnter={() => warm(b.id)}>
                  <td><div style={{ fontWeight: 600 }}>{b.name}</div><div className="muted small mono">{b.code}</div></td>
                  <td>{b.fiscal_year?.code}</td>
                  <td>{b.revision_no}</td>
                  <td>{money(b.totals.planned, b.currency)}</td>
                  <td>{money(b.totals.approved, b.currency)}</td>
                  <td>{money(b.totals.actual, b.currency)}</td>
                  <td><StatusBadge status={b.status} label={BUDGET_STATUS_LABELS[b.status]} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {creating && (
        <CreateBudget orgId={orgId} onClose={() => setCreating(false)} onCreated={(b) => { invalidate(['mgmt-budgets', orgId]); navigate(`/budgets/${b.id}`) }} />
      )}
    </div>
  )
}

function CreateBudget({ orgId, onClose, onCreated }) {
  const years = useLookup(['mgmt-years', orgId], ({ signal }) => planningApi.fiscalYears(orgId, { signal }), { enabled: Boolean(orgId) })
  const [yearId, setYearId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fields = getFieldErrors(error)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onCreated(await budgetsApi.create(orgId, { fiscal_year_id: yearId || years.data?.[0]?.id, code: code.trim(), name: name.trim(), currency: currency.trim().toUpperCase() }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title="New budget" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="b-year">Fiscal year</label>
          <select id="b-year" value={yearId || years.data?.[0]?.id || ''} onChange={(e) => setYearId(e.target.value)} required>
            {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="b-code">Code</label><input id="b-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          {fields.code && <div className="field-error">{fields.code}</div>}</div>
        <div className="field"><label htmlFor="b-name">Name</label><input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="field">
          <label htmlFor="b-currency">Currency</label>
          <input id="b-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} placeholder="e.g. INR" required />
          <div className="hint">A budget states its currency; there is no default.</div>
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving || !years.data?.length}>{saving ? 'Creating…' : 'Create budget'}</button>
        </div>
      </form>
    </Dialog>
  )
}
