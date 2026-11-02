import { useState } from 'react'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { planningApi } from '@/features/management/api.js'
import { CheckInDialog, RagBadge } from '@/features/management/components.jsx'
import { byStart, PRIORITY_LABELS } from '@/features/management/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { usersApi } from '@/features/users/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

// Fiscal years (with their quarters and months) and the goals that cascade through them.
export default function Planning() {
  const { user } = useAuth()
  const { orgId } = useActiveOrg()
  const canYears = hasAccess(user, ACCESS.manageFiscalYears)
  const canGoals = hasAccess(user, ACCESS.manageGoals)
  const canCheckIn = hasAccess(user, ACCESS.checkIn)
  const [dialog, setDialog] = useState(null) // 'year' | 'goal'
  const [checkingIn, setCheckingIn] = useState(null)

  const years = useQuery(['mgmt-years', orgId], ({ signal }) => planningApi.fiscalYears(orgId, { signal }).then(byStart), {
    enabled: Boolean(orgId && hasAccess(user, { permissions: ['management.fiscal_year.read'] })),
  })
  const goals = useQuery(['mgmt-goals', orgId], ({ signal }) => planningApi.goals(orgId, { limit: 100 }, { signal }), {
    enabled: Boolean(orgId && hasAccess(user, ACCESS.goals)),
  })
  const reload = () => {
    invalidate(['mgmt-years', orgId])
    invalidate(['mgmt-goals', orgId])
    invalidate(['mgmt-scorecard', orgId])
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Planning</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Fiscal years, and the goals the company is working towards.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {canYears && <button className="btn secondary" onClick={() => setDialog('year')}>+ Fiscal year</button>}
          {canGoals && <button className="btn" onClick={() => setDialog('goal')}>+ Goal</button>}
        </div>
      </div>

      <ErrorBanner error={years.error || goals.error} />

      {hasAccess(user, { permissions: ['management.fiscal_year.read'] }) && (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Fiscal year</th><th>From</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              {years.loading ? <TableSkeleton cols={4} rows={3} /> : (years.data ?? []).length === 0 ? (
                <tr><td colSpan={4} className="center-note">No fiscal years yet.</td></tr>
              ) : (
                years.data.map((y) => (
                  <tr key={y.id}>
                    <td style={{ fontWeight: 600 }}>{y.code}</td>
                    <td>{formatDate(y.start_date)}</td>
                    <td>{formatDate(y.end_date)}</td>
                    <td><StatusBadge status={y.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasAccess(user, ACCESS.goals) && (
        <div className="panel" style={{ padding: 0, overflowX: 'auto', marginTop: 16 }}>
          <table>
            <thead><tr><th>Goal</th><th>Owner</th><th>Period</th><th>Priority</th><th>Latest check-in</th><th /></tr></thead>
            <tbody>
              {goals.loading ? <TableSkeleton cols={6} rows={4} /> : (goals.data?.data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="center-note">No goals yet.</td></tr>
              ) : (
                goals.data.data.map((g) => (
                  <tr key={g.id}>
                    <td><div style={{ fontWeight: 600 }}>{g.name}</div><div className="muted small mono">{g.code}</div></td>
                    <td>{g.owner?.name || 'Unknown'}</td>
                    <td>{g.period?.name || <span className="muted">Any</span>}</td>
                    <td><StatusBadge status={g.priority} label={PRIORITY_LABELS[g.priority]} /></td>
                    <td>
                      {g.latest_check_in ? (
                        <><RagBadge rag={g.latest_check_in.rag} /> <span className="muted small">{g.latest_check_in.narrative}</span></>
                      ) : <span className="muted">None</span>}
                    </td>
                    <td>{canCheckIn && <button className="btn secondary small-btn" onClick={() => setCheckingIn(g)}>Check in</button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialog === 'year' && <FiscalYearDialog orgId={orgId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload() }} />}
      {dialog === 'goal' && (
        <GoalDialog orgId={orgId} me={user} years={years.data ?? []} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload() }} />
      )}
      {checkingIn && (
        <CheckInDialog orgId={orgId} goal={checkingIn} onClose={() => setCheckingIn(null)} onSaved={() => { setCheckingIn(null); reload() }} />
      )}
    </div>
  )
}

function useSubmit(action, onSaved) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await action()
      onSaved()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }
  return { saving, error, submit }
}

const fieldError = (error, field) => getFieldErrors(error)?.[field]

function FiscalYearDialog({ orgId, onClose, onSaved }) {
  const year = new Date().getFullYear()
  const [code, setCode] = useState(`FY${year}`)
  const [start, setStart] = useState(`${year}-04-01`)
  const [end, setEnd] = useState(`${year + 1}-03-31`)
  const [months, setMonths] = useState(true)
  const { saving, error, submit } = useSubmit(
    () => planningApi.createFiscalYear(orgId, { code: code.trim(), start_date: start, end_date: end, period_types: months ? ['quarter', 'month'] : ['quarter'] }),
    onSaved
  )
  return (
    <Dialog title="New fiscal year" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="field">
          <label htmlFor="fy-code">Name</label>
          <input id="fy-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          {fieldError(error, 'code') && <div className="field-error">{fieldError(error, 'code')}</div>}
        </div>
        <div className="field"><label htmlFor="fy-start">Starts</label><input id="fy-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div className="field">
          <label htmlFor="fy-end">Ends</label>
          <input id="fy-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
          {fieldError(error, 'end_date') && <div className="field-error">{fieldError(error, 'end_date')}</div>}
        </div>
        <label className="field"><input type="checkbox" checked={months} onChange={(e) => setMonths(e.target.checked)} /> <span style={{ display: 'inline' }}>Also create the months</span></label>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create (with quarters)'}</button>
        </div>
      </form>
    </Dialog>
  )
}

function GoalDialog({ orgId, me, years, onClose, onSaved }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState(me?.id || '')
  const [priority, setPriority] = useState('medium')
  const [yearId, setYearId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const people = useLookup(['users', orgId, 'all'], ({ signal }) => usersApi.list(orgId, { limit: 100 }, { signal }).then((r) => r.data || []), {
    enabled: Boolean(orgId),
  })
  const periods = useLookup(['mgmt-periods', orgId, yearId], ({ signal }) => planningApi.periods(orgId, yearId, { signal }).then(byStart), {
    enabled: Boolean(orgId && yearId),
  })
  const { saving, error, submit } = useSubmit(
    () => planningApi.createGoal(orgId, { code: code.trim(), name: name.trim(), owner_user_id: owner, priority, period_id: periodId || null }),
    onSaved
  )
  const users = people.data?.length ? people.data : me ? [{ id: me.id, name: me.name || 'Me' }] : []
  return (
    <Dialog title="New goal" onClose={onClose}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="field"><label htmlFor="g-code">Code</label><input id="g-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          {fieldError(error, 'code') && <div className="field-error">{fieldError(error, 'code')}</div>}</div>
        <div className="field"><label htmlFor="g-name">Name</label><input id="g-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="field">
          <label htmlFor="g-owner">Owner</label>
          <select id="g-owner" value={owner} onChange={(e) => setOwner(e.target.value)} required>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-priority">Priority</label>
          <select id="g-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {Object.entries(PRIORITY_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-year">Fiscal year</label>
          <select id="g-year" value={yearId} onChange={(e) => { setYearId(e.target.value); setPeriodId('') }}>
            <option value="">Not tied to a period</option>
            {years.map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
          </select>
        </div>
        {yearId && (
          <div className="field">
            <label htmlFor="g-period">Period</label>
            <select id="g-period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">The whole year</option>
              {(periods.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create goal'}</button>
        </div>
      </form>
    </Dialog>
  )
}
