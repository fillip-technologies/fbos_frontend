import { useState } from 'react'
import { Link } from 'react-router-dom'
import { projectsApi } from '@/features/delivery/api.js'
import HandOver from '@/features/delivery/components/HandOver.jsx'
import {
  PROJECT_NEXT_STATUSES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  SUBJECT_TYPES,
  TASK_STATUS_LABELS,
} from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { changedFields, formatMoney } from '@/features/customers/utils.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import { formatDate } from '@/shared/utils/format.js'
import { useRecordForm } from '@/shared/utils/useRecordForm.js'

function Detail({ label, children }) {
  return (
    <div>
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children || <span className="muted">—</span>}</div>
    </div>
  )
}

// The editable part of a project, as the edit form holds it.
const toForm = (p) => ({
  name: p.name,
  objective: p.objective || '',
  manager_user_id: p.manager.id,
  priority: p.priority,
  planned_end: p.planned_end,
})

export default function ProjectOverview({ orgId, project, setProject, names }) {
  const { user: me } = useAuth()
  const canManage = hasAccess(me, ACCESS.manageProjects)
  const { data: summary, loading: summaryLoading } = useQuery(
    ['project', orgId, project.id, 'summary'],
    ({ signal }) => projectsApi.summary(orgId, project.id, { signal }),
    { enabled: Boolean(orgId) }
  )

  return (
    <>
      <div className="panel">
        <div className="details-grid">
          <Detail label="Kind">{project.type.name}</Detail>
          <Detail label="Template">{project.template?.name}</Detail>
          <Detail label="Customer">
            {project.client && <Link to={`/customers/${project.client.id}`}>{names.customerName(project.client)}</Link>}
          </Detail>
          <Detail label="Contract">{project.contract && <Link to={`/contracts/${project.contract.id}`}>Open contract</Link>}</Detail>
          <Detail label="Manager">{names.personName(project.manager)}</Detail>
          <Detail label="Delivering team">{names.unitName(project.owning_unit)}</Detail>
          <Detail label="Vertical">{project.vertical && names.verticalName(project.vertical)}</Detail>
          <Detail label="Priority">{PROJECT_PRIORITY_LABELS[project.priority]}</Detail>
          <Detail label="Planned">{`${formatDate(project.planned_start)} → ${formatDate(project.planned_end)}`}</Detail>
          <Detail label="Actual">
            {project.actual_start && `${formatDate(project.actual_start)} → ${project.actual_end ? formatDate(project.actual_end) : 'ongoing'}`}
          </Detail>
          <Detail label="Billable">{project.billable ? 'Yes' : 'No'}</Detail>
          <Detail label="Approved budget">{project.budget?.approved && formatMoney(project.budget.approved)}</Detail>
          <Detail label="Progress">{`${Math.round(project.progress_pct)}%`}</Detail>
        </div>
        {project.objective && <p style={{ marginBottom: 0 }}>{project.objective}</p>}
      </div>

      {project.attributes && Object.keys(project.attributes).length > 0 && (
        <div className="panel">
          <h2 style={{ fontSize: 15, margin: '0 0 12px', fontWeight: 600 }}>Custom attributes</h2>
          <div className="details-grid">
            {Object.entries(project.attributes).map(([key, val]) => (
              <Detail key={key} label={key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}>
                {typeof val === 'boolean'
                  ? val ? 'Yes' : 'No'
                  : typeof val === 'object' && val !== null
                  ? JSON.stringify(val)
                  : String(val ?? '—')}
              </Detail>
            ))}
          </div>
        </div>
      )}

      {summaryLoading ? <PanelSkeleton /> : summary && <ProjectCounts summary={summary} />}
      <HandOver
        orgId={orgId}
        subject={{ type: SUBJECT_TYPES.project, id: project.id }}
        fromUnit={project.owning_unit}
        names={names}
        finished={['closed', 'cancelled'].includes(project.status)}
      />
      {canManage && <StatusChange orgId={orgId} project={project} setProject={setProject} />}
      {canManage && <EditProject orgId={orgId} project={project} setProject={setProject} names={names} />}
    </>
  )
}

function ProjectCounts({ summary }) {
  const milestones = summary.milestones
  const finished = milestones.filter((m) => ['accepted', 'completed'].includes(m.status)).length
  const tasks = Object.entries(summary.tasks_by_status)
  return (
    <div className="panel">
      <div className="details-grid">
        <Detail label="Milestones">{milestones.length ? `${finished} of ${milestones.length} done` : 'None yet'}</Detail>
        <Detail label="Open risks">{String(summary.risks_open)}</Detail>
        <Detail label="Changes waiting for a decision">{String(summary.pending_approvals)}</Detail>
        <Detail label="Tasks">
          {tasks.length ? tasks.map(([status, count]) => `${count} ${(TASK_STATUS_LABELS[status] || status).toLowerCase()}`).join(', ') : 'None yet'}
        </Detail>
      </div>
    </div>
  )
}

function StatusChange({ orgId, project, setProject }) {
  const nextStatuses = PROJECT_NEXT_STATUSES[project.status] || []
  const [toStatus, setToStatus] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (nextStatuses.length === 0) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setProject(await projectsApi.changeStatus(orgId, project, { to_status: toStatus, reason: reason.trim() }))
      setToStatus('')
      setReason('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Change status</h2>
      <ErrorBanner error={error} />
      <div className="grid-3">
        <div className="field">
          <label htmlFor="to_status">Move to</label>
          <select id="to_status" required value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
            <option value="">— Choose —</option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="status_reason">Why *</label>
          <input id="status_reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {toStatus === 'closed' && (
        <div className="hint">A project closes only when its tasks, risks and change requests are settled and every milestone is done.</div>
      )}
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Change status</button>
    </form>
  )
}

function EditProject({ orgId, project, setProject, names }) {
  const { user: me } = useAuth()
  const { form, base, setForm, rebase } = useRecordForm(project, toForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const fieldErrors = getFieldErrors(error)
  if (!form) return null
  const set = (key, value) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }
  // The plan's dates are fixed once work starts; after that they move by change request.
  const canMoveDueDate = ['draft', 'planned'].includes(base.status)
  const managers = names.people || [me].filter(Boolean)

  async function handleSave(e) {
    e.preventDefault()
    const changes = changedFields(toForm(base), form)
    if (Object.keys(changes).length === 0) return
    if ('objective' in changes) changes.objective = changes.objective.trim() // "" clears it; null would be ignored
    setError(null)
    setBusy(true)
    try {
      const updated = await projectsApi.update(orgId, base.id, base.version, changes)
      setProject(updated)
      rebase(updated)
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSave}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Edit project</h2>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      {saved && <div className="alert success">Saved.</div>}
      <div className="field">
        <label htmlFor="edit_name">Name</label>
        <input id="edit_name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="edit_objective">Objective</label>
        <textarea id="edit_objective" rows={2} value={form.objective} onChange={(e) => set('objective', e.target.value)} />
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="edit_manager">Project manager</label>
          <select id="edit_manager" value={form.manager_user_id} onChange={(e) => set('manager_user_id', e.target.value)}>
            {managers.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
            {!managers.some((u) => u.id === form.manager_user_id) && <option value={form.manager_user_id}>{names.personName(form.manager_user_id)}</option>}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit_priority">Priority</label>
          <select id="edit_priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit_due">Due</label>
          <input
            id="edit_due"
            type="date"
            disabled={!canMoveDueDate}
            value={form.planned_end}
            onChange={(e) => set('planned_end', e.target.value)}
          />
          {!canMoveDueDate && <div className="hint">Work has started: move the date with a change request.</div>}
        </div>
      </div>
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Save changes</button>
    </form>
  )
}
