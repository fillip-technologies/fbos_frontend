import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { projectsApi, setupApi, tasksApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS, dueAtFromDate, parseDuration } from '@/features/delivery/utils.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

export default function TaskCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const enabled = Boolean(orgId)
  const { data: taskTypes = [] } = useLookup(['task-types', orgId], ({ signal }) => setupApi.taskTypes(orgId, { signal }), { enabled })
  const { data: projects = [] } = useLookup(['projects', orgId, 'options'], ({ signal }) => projectsApi.options(orgId, { signal }), { enabled })

  const projectId = params.get('project') || ''
  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type_code: 'task',
    project_id: projectId,
    owning_unit_id: '',
    assignee_user_id: '',
    reviewer_user_id: '',
    priority: 'p3',
    due_date: '',
    estimate: '',
    checklist: '',
    labels: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const openProjects = projects.filter((p) => !['closed', 'cancelled'].includes(p.status))
  const chosenProject = projects.find((p) => p.id === form.project_id)
  // The project's delivering team owns its tasks unless another team is chosen.
  const owningUnitId = form.owning_unit_id || chosenProject?.owning_unit?.id || ''
  const people = names.people || [me].filter(Boolean)
  const estimateMinutes = parseDuration(form.estimate)
  const estimateInvalid = form.estimate.trim() !== '' && estimateMinutes === null

  async function handleSubmit(e) {
    e.preventDefault()
    if (estimateInvalid) return
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        title: form.title.trim(),
        task_type_code: form.task_type_code,
        subject: { type: SUBJECT_TYPES.project, id: form.project_id },
        owning_unit_id: owningUnitId,
        priority: form.priority,
        checklist: form.checklist.split('\n').map((line) => line.trim()).filter(Boolean).map((text) => ({ text })),
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
      }
      if (form.description.trim()) body.description = form.description.trim()
      if (form.assignee_user_id) body.assignee_user_id = form.assignee_user_id
      if (form.reviewer_user_id) body.reviewer_user_id = form.reviewer_user_id
      if (form.due_date) body.due_at = dueAtFromDate(form.due_date)
      if (estimateMinutes) body.estimate_minutes = estimateMinutes
      const created = await tasksApi.create(orgId, body)
      invalidate(['tasks', orgId])
      if (created.work_unit_id) invalidate(['project', orgId, created.work_unit_id])
      navigate(`/tasks/${created.id}`, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New task</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <form className="panel" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Title *</label>
          <input id="title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
          {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="project_id">Project *</label>
          <select id="project_id" required value={form.project_id} onChange={(e) => set('project_id', e.target.value)}>
            <option value="">— Choose —</option>
            {openProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid-3">
          <div className="field">
            <label htmlFor="task_type_code">Type</label>
            <select id="task_type_code" value={form.task_type_code} onChange={(e) => set('task_type_code', e.target.value)}>
              {taskTypes.map((t) => (
                <option key={t.code} value={t.code}>{t.name}{t.requires_review ? ' (reviewed)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="owning_unit_id">Team *</label>
            <select id="owning_unit_id" required value={owningUnitId} onChange={(e) => set('owning_unit_id', e.target.value)}>
              <option value="">— Choose —</option>
              {(names.units || []).filter((u) => u.status !== 'inactive').map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-3">
          <div className="field">
            <label htmlFor="assignee_user_id">Assignee</label>
            <select id="assignee_user_id" value={form.assignee_user_id} onChange={(e) => set('assignee_user_id', e.target.value)}>
              <option value="">— Leave in the team's queue —</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reviewer_user_id">Reviewer</label>
            <select id="reviewer_user_id" value={form.reviewer_user_id} onChange={(e) => set('reviewer_user_id', e.target.value)}>
              <option value="">— Anyone allowed to review —</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="due_date">Due</label>
            <input id="due_date" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="estimate">Estimate</label>
            <input id="estimate" placeholder="e.g. 2h 30m" value={form.estimate} onChange={(e) => set('estimate', e.target.value)} />
            {estimateInvalid && <div className="field-error">Write it like 90, 1h 30m or 1.5h.</div>}
          </div>
          <div className="field">
            <label htmlFor="labels">Labels</label>
            <input id="labels" placeholder="Comma separated" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="checklist">Checklist</label>
          <textarea
            id="checklist"
            rows={3}
            placeholder="One item per line. Each must be ticked before the task is submitted."
            value={form.checklist}
            onChange={(e) => set('checklist', e.target.value)}
          />
        </div>

        <button className="btn" type="submit" disabled={submitting} aria-busy={submitting}>Create task</button>
      </form>
    </div>
  )
}
