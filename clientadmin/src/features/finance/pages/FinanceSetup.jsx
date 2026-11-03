import { useState } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { expenseCategoriesApi, financeSettingsApi } from '@/features/finance/api.js'
import { amountOrNull, money } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton, TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// The expense approval limit, the company's currency for finance records, and expense categories.
export default function FinanceSetup() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canManage = hasAccess(user, ACCESS.financeSetup)
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Expense setup</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>When expenses need approval, and the categories people file them under.</p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>
      <SettingsPanel key={`s-${orgId}`} orgId={orgId} canManage={canManage} />
      <CategoriesPanel orgId={orgId} canManage={canManage} />
    </div>
  )
}

function SettingsPanel({ orgId, canManage }) {
  const query = useQuery(['finance-settings', orgId], ({ signal }) => financeSettingsApi.get(orgId, { signal }), { enabled: Boolean(orgId) })
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const settings = query.data
  if (query.error && !settings) return <ErrorBanner error={query.error} onRetry={query.reload} />
  if (!settings) return <PanelSkeleton panels={1} />
  const current = form ?? { threshold: settings.expense_approval_threshold ?? '', currency: settings.default_currency }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await financeSettingsApi.update(orgId, {
        expense_approval_threshold: amountOrNull(current.threshold),
        default_currency: current.currency.trim().toUpperCase(),
      })
      query.setData(next)
      invalidate(['finance-settings', orgId])
      setForm(null)
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const set = (key) => (e) => { setSaved(false); setForm({ ...current, [key]: e.target.value }) }
  return (
    <form className="panel" onSubmit={submit}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Approval</h2>
      <ErrorBanner error={error} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor="f-threshold">Expenses above this total need approval</label>
          <input id="f-threshold" type="number" min="0" step="0.01" value={current.threshold} onChange={set('threshold')} disabled={!canManage} placeholder="No limit" />
          <div className="hint">
            {current.threshold === ''
              ? 'Empty: expenses never wait for approval.'
              : `Above ${money(current.threshold, current.currency || 'INR')} (with tax), an expense waits for someone other than who recorded it. Applies to expenses recorded or changed from now on.`}
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-currency">Company currency for expenses and investments</label>
          <input id="f-currency" value={current.currency} onChange={set('currency')} maxLength={3} minLength={3} required disabled={!canManage} />
        </div>
      </div>
      {canManage && (
        <div className="row-actions">
          {saved && <span className="muted small">Saved.</span>}
          <button className="btn" disabled={saving || !form} aria-busy={saving}>Save</button>
        </div>
      )}
    </form>
  )
}

function CategoriesPanel({ orgId, canManage }) {
  const query = useQuery(['finance-categories', orgId, 'all'],
    ({ signal }) => expenseCategoriesApi.list(orgId, { includeInactive: true }, { signal }), { enabled: Boolean(orgId) })
  const [adding, setAdding] = useState({ code: '', name: '', description: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const fields = getFieldErrors(error)

  async function act(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      invalidate(['finance-categories', orgId])
      query.reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const add = (e) => {
    e.preventDefault()
    act(async () => {
      await expenseCategoriesApi.create(orgId, { code: adding.code.trim(), name: adding.name.trim(), description: adding.description.trim() || null })
      setAdding({ code: '', name: '', description: '' })
    })
  }
  const rename = (c) => {
    const name = window.prompt('New name for this category', c.name)
    if (name && name.trim() && name.trim() !== c.name) act(() => expenseCategoriesApi.update(orgId, c.id, { name: name.trim() }))
  }

  const rows = query.data ?? []
  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <h2 style={{ padding: '14px 16px 0', margin: 0, fontSize: 16 }}>Expense categories</h2>
      <p className="muted small" style={{ padding: '0 16px' }}>
        There is no category for hardware, salaries or project costs on purpose: those are recorded in Inventory, Payroll and on the project.
      </p>
      <ErrorBanner error={query.error || error} onRetry={query.error ? query.reload : undefined} />
      <table>
        <thead><tr><th>Category</th><th>Code</th><th>What goes here</th><th>Status</th><th /></tr></thead>
        <tbody>
          {query.loading ? <TableSkeleton cols={5} /> : rows.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.name}{c.is_builtin && <span className="muted small"> · built in</span>}</td>
              <td className="mono">{c.code}</td>
              <td className="muted small">{c.description}</td>
              <td><StatusBadge status={c.is_active ? 'active' : 'inactive'} label={c.is_active ? 'In use' : 'Switched off'} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {canManage && (
                  <>
                    <button type="button" className="link-btn" disabled={busy} onClick={() => rename(c)}>Rename</button>{' · '}
                    <button type="button" className="link-btn" disabled={busy} onClick={() => act(() => expenseCategoriesApi.update(orgId, c.id, { is_active: !c.is_active }))}>
                      {c.is_active ? 'Switch off' : 'Switch on'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManage && (
        <form onSubmit={add} style={{ padding: 16 }}>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="c-name">New category</label>
              <input id="c-name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} maxLength={120} required placeholder="e.g. Events" />
            </div>
            <div className="field">
              <label htmlFor="c-code">Code</label>
              <input id="c-code" value={adding.code} pattern="[a-z0-9_]+" maxLength={50} required placeholder="events"
                onChange={(e) => setAdding({ ...adding, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
              {fields.code && <div className="field-error">{fields.code}</div>}
            </div>
            <div className="field">
              <button className="btn" disabled={busy} aria-busy={busy}>Add category</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="c-description">What goes here (optional)</label>
            <input id="c-description" value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} maxLength={500} />
          </div>
        </form>
      )}
    </div>
  )
}
