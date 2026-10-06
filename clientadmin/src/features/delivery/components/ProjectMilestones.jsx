import { useState } from 'react'
import { milestonesApi, projectsApi } from '@/features/delivery/api.js'
import { MILESTONE_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { formatDate } from '@/shared/utils/format.js'

const SUBMITTABLE = ['pending', 'in_progress', 'rejected']

export default function ProjectMilestones({ orgId, project }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageProjects)
  const key = ['project', orgId, project.id, 'milestones']
  const { data: milestones = [], error, loading, refreshing, reload, setData } = useQuery(
    key,
    ({ signal }) => projectsApi.milestones(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [acting, setActing] = useState(null) // { milestone, kind: 'accept' | 'reject' }
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // One milestone changed: replace it in place; the project summary counts it.
  function replace(saved) {
    setData((list) => (list ?? []).map((m) => (m.id === saved.id ? saved : m)))
    invalidate(['project', orgId, project.id, 'summary'])
  }

  async function run(milestone, call) {
    setActionError(null)
    setBusyId(milestone.id)
    try {
      replace(await call())
      setActing(null)
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
              <th>#</th>
              <th>Milestone</th>
              <th>Planned</th>
              <th>Forecast</th>
              <th>Done on</th>
              <th>Status</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={canManage ? 7 : 6} rows={3} />
            ) : milestones.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No milestones yet.</td></tr>
            ) : (
              milestones.map((m) => (
                <tr key={m.id} style={{ cursor: 'default' }}>
                  <td>{m.seq}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div className="muted small">
                      <span className="mono">{m.code}</span>
                      {m.is_billing_milestone && ' · invoiced on completion'}
                      {m.requires_client_acceptance && ' · customer signs off'}
                    </div>
                  </td>
                  <td>{formatDate(m.planned_date)}</td>
                  <td>
                    {canManage && SUBMITTABLE.includes(m.status) ? (
                      <input
                        type="date"
                        aria-label={`Forecast for ${m.name}`}
                        value={m.forecast_date || ''}
                        disabled={busyId === m.id}
                        onChange={(e) => run(m, () => milestonesApi.update(orgId, m.id, { forecast_date: e.target.value || null }))}
                      />
                    ) : (
                      formatDate(m.forecast_date)
                    )}
                  </td>
                  <td>{formatDate(m.actual_date)}</td>
                  <td><StatusBadge status={m.status} label={MILESTONE_STATUS_LABELS[m.status]} /></td>
                  {canManage && (
                    <td className="row-actions">
                      {SUBMITTABLE.includes(m.status) && (
                        <button className="btn secondary small-btn" disabled={busyId === m.id} onClick={() => run(m, () => milestonesApi.submit(orgId, m.id))}>
                          Submit
                        </button>
                      )}
                      {m.status === 'submitted' && (
                        <>
                          <button className="btn secondary small-btn" onClick={() => setActing({ milestone: m, kind: 'accept' })}>Accept</button>
                          <button className="btn secondary small-btn" onClick={() => setActing({ milestone: m, kind: 'reject' })}>Reject</button>
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

      {acting && (
        <DecisionForm
          acting={acting}
          busy={busyId === acting.milestone.id}
          onCancel={() => setActing(null)}
          onSubmit={(body) =>
            run(acting.milestone, () =>
              acting.kind === 'accept'
                ? milestonesApi.accept(orgId, acting.milestone.id, body)
                : milestonesApi.reject(orgId, acting.milestone.id, body)
            )
          }
        />
      )}
      {canManage && <AddMilestone orgId={orgId} project={project} onAdded={(m) => setData((list) => [...(list ?? []), m])} />}
    </>
  )
}

function DecisionForm({ acting, busy, onCancel, onSubmit }) {
  const accepting = acting.kind === 'accept'
  const [acceptedBy, setAcceptedBy] = useState('')
  const [acceptedOn, setAcceptedOn] = useState(todayIso())
  const [reason, setReason] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(accepting ? { accepted_by_name: acceptedBy.trim(), accepted_on: acceptedOn } : { reason: reason.trim() })
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        {accepting ? 'Accept' : 'Reject'} “{acting.milestone.name}”
      </h2>
      {accepting ? (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="accepted_by">Accepted by *</label>
            <input id="accepted_by" required placeholder="Who signed it off" value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="accepted_on">On *</label>
            <input id="accepted_on" type="date" required max={todayIso()} value={acceptedOn} onChange={(e) => setAcceptedOn(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="reject_reason">What needs fixing *</label>
          <input id="reject_reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{accepting ? 'Accept' : 'Reject'}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

const NEW_MILESTONE = { code: '', name: '', planned_date: '', is_billing_milestone: false, requires_client_acceptance: false }

function AddMilestone({ orgId, project, onAdded }) {
  const [form, setForm] = useState(NEW_MILESTONE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      onAdded(await projectsApi.addMilestone(orgId, project.id, { ...form, code: form.code.trim(), name: form.name.trim() }))
      invalidate(['project', orgId, project.id, 'summary'])
      setForm(NEW_MILESTONE)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Add a milestone</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="ms_code">Code *</label>
          <input id="ms_code" required maxLength={100} placeholder="M1" value={form.code} onChange={(e) => set('code', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ms_name">Name *</label>
          <input id="ms_name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ms_date">Planned for *</label>
          <input id="ms_date" type="date" required value={form.planned_date} onChange={(e) => set('planned_date', e.target.value)} />
        </div>
      </div>
      <div className="row-actions" style={{ gap: 18, marginBottom: 12 }}>
        <label className="inline-check">
          <input type="checkbox" checked={form.is_billing_milestone} onChange={(e) => set('is_billing_milestone', e.target.checked)} />
          Invoice the customer when it's done
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={form.requires_client_acceptance}
            onChange={(e) => set('requires_client_acceptance', e.target.checked)}
          />
          The customer signs it off
        </label>
      </div>
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Add milestone</button>
    </form>
  )
}
