import { useState } from 'react'
import { changeRequestsApi, projectsApi } from '@/features/delivery/api.js'
import { CHANGE_REQUEST_STATUS_LABELS, formatDateTime } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

export default function ProjectChangeRequests({ orgId, project, names }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageProjects)
  const canDecide = hasAccess(me, ACCESS.decideChangeRequests)
  const { data: changes = [], error, loading, refreshing, reload, setData } = useQuery(
    ['project', orgId, project.id, 'change-requests'],
    ({ signal }) => projectsApi.changeRequests(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [deciding, setDeciding] = useState(null) // { change, approve: boolean }
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function run(change, call) {
    setActionError(null)
    setBusyId(change.id)
    try {
      const saved = await call()
      setData((list) => (list ?? []).map((c) => (c.id === saved.id ? saved : c)))
      if (saved.status === 'approved') {
        // The approved impact moved the due date and grew the budget.
        invalidate(['project', orgId, project.id])
        invalidate(['projects', orgId])
      } else {
        invalidate(['project', orgId, project.id, 'summary'])
      }
      setDeciding(null)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <ErrorBanner error={actionError || error} onRetry={actionError ? undefined : reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Change</th>
              <th>Schedule</th>
              <th>Cost</th>
              <th>Status</th>
              <th>Decision</th>
              {(canManage || canDecide) && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} rows={3} />
            ) : changes.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No change requests.</td></tr>
            ) : (
              changes.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      <span className="mono">{c.cr_no}</span> {c.title}
                    </div>
                    <div className="muted small">{c.scope_impact}</div>
                    {c.amends_contract && <div className="muted small">Changes the contract</div>}
                  </td>
                  <td>
                    {formatDays(c.approved_schedule_impact_days ?? c.schedule_impact_days)}
                    {c.approved_schedule_impact_days != null && c.approved_schedule_impact_days !== c.schedule_impact_days && (
                      <div className="muted small">asked {formatDays(c.schedule_impact_days)}</div>
                    )}
                  </td>
                  <td>
                    {formatMoney(c.approved_cost_impact ?? c.cost_impact)}
                    {c.approved_cost_impact && c.approved_cost_impact.amount !== c.cost_impact.amount && (
                      <div className="muted small">asked {formatMoney(c.cost_impact)}</div>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} label={CHANGE_REQUEST_STATUS_LABELS[c.status]} /></td>
                  <td className="small">
                    {c.decided_at ? (
                      <>
                        {names.personName(c.decided_by)} · {formatDateTime(c.decided_at)}
                        {c.decision_note && <div className="muted">{c.decision_note}</div>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {(canManage || canDecide) && (
                    <td className="row-actions">
                      {canManage && c.status === 'draft' && (
                        <button className="btn secondary small-btn" disabled={busyId === c.id} onClick={() => run(c, () => changeRequestsApi.submit(orgId, c.id))}>
                          Submit
                        </button>
                      )}
                      {canDecide && c.status === 'submitted' && (
                        <>
                          <button className="btn secondary small-btn" onClick={() => setDeciding({ change: c, approve: true })}>Approve</button>
                          <button className="btn secondary small-btn" onClick={() => setDeciding({ change: c, approve: false })}>Reject</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deciding && (
        <DecisionForm
          deciding={deciding}
          busy={busyId === deciding.change.id}
          onCancel={() => setDeciding(null)}
          onSubmit={(decision) =>
            run(deciding.change, () =>
              deciding.approve
                ? changeRequestsApi.approve(orgId, deciding.change.id, decision)
                : changeRequestsApi.reject(orgId, deciding.change.id, { reason: decision.note })
            )
          }
        />
      )}
      {canManage && <RaiseChange orgId={orgId} project={project} onRaised={(c) => setData((list) => [...(list ?? []), c])} />}
    </>
  )
}

const formatDays = (days) => (days ? `${days > 0 ? '+' : ''}${days} days` : '—')

// Approving decides the impact from the change in work: it starts from what was asked and
// moves the project's due date and grows its budget by what is approved.
function DecisionForm({ deciding, busy, onCancel, onSubmit }) {
  const { change, approve } = deciding
  const [note, setNote] = useState('')
  const [days, setDays] = useState(String(change.schedule_impact_days))
  const [cost, setCost] = useState(String(Number(change.cost_impact.amount)))

  function handleSubmit(e) {
    e.preventDefault()
    if (!approve) return onSubmit({ note: note.trim() })
    onSubmit({
      ...(note.trim() ? { note: note.trim() } : {}),
      schedule_impact_days: Number(days) || 0,
      cost_impact: { amount: Number(cost) || 0, currency: change.cost_impact.currency },
    })
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        {approve ? 'Approve' : 'Reject'} {change.cr_no} “{change.title}”
      </h2>
      {approve && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="approved_days">Extra days approved</label>
            <input id="approved_days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
            <div className="hint">Asked: {formatDays(change.schedule_impact_days)}</div>
          </div>
          <div className="field">
            <label htmlFor="approved_cost">Extra cost approved ({change.cost_impact.currency})</label>
            <input id="approved_cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            <div className="hint">Asked: {formatMoney(change.cost_impact)}</div>
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="decision_note">{approve ? 'Note' : 'Why not *'}</label>
        <input id="decision_note" required={!approve} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {approve && (
        <div className="hint" style={{ marginBottom: 10 }}>
          Approving moves the project's due date by these days and adds this cost to its budget.
        </div>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{approve ? 'Approve' : 'Reject'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

const NEW_CHANGE = { title: '', reason: '', scope_impact: '', schedule_impact_days: 0, cost: '0', amends_contract: false }

function RaiseChange({ orgId, project, onRaised }) {
  const [form, setForm] = useState(NEW_CHANGE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const raised = await projectsApi.addChangeRequest(orgId, project.id, {
        title: form.title.trim(),
        reason: form.reason.trim(),
        scope_impact: form.scope_impact.trim(),
        schedule_impact_days: Number(form.schedule_impact_days) || 0,
        cost_impact: { amount: Number(form.cost) || 0, currency: 'INR' },
        amends_contract: form.amends_contract,
      })
      onRaised(raised)
      setForm(NEW_CHANGE)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Raise a change request</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="field">
        <label htmlFor="cr_title">What changes *</label>
        <input id="cr_title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="cr_reason">Why *</label>
          <textarea id="cr_reason" required rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cr_scope">Effect on the scope *</label>
          <textarea id="cr_scope" required rows={2} value={form.scope_impact} onChange={(e) => set('scope_impact', e.target.value)} />
        </div>
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="cr_days">Extra days</label>
          <input id="cr_days" type="number" value={form.schedule_impact_days} onChange={(e) => set('schedule_impact_days', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cr_cost">Extra cost (INR)</label>
          <input id="cr_cost" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
        </div>
        <label className="inline-check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={form.amends_contract} onChange={(e) => set('amends_contract', e.target.checked)} />
          Changes the contract
        </label>
      </div>
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Raise change request</button>
    </form>
  )
}
