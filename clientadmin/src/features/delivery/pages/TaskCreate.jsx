import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { lookupsApi, projectsApi, tasksApi } from '@/features/delivery/api.js'
import TaskFieldInputs from '@/features/delivery/components/TaskFieldInputs.jsx'
import {
  DISCIPLINE_ORDER,
  attributeErrors,
  checkFields,
  disciplineLabel,
  formatTarget,
  isEmpty,
  toAttributes,
} from '@/features/delivery/taskFields.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes, { useTaskFields } from '@/features/delivery/useTaskTypes.js'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS, dueAtFromDate, parseDuration } from '@/features/delivery/utils.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// A lead's contact details fill a sales touch's matching fields.
const FROM_LEAD = { phone: 'contact_phone', email_address: 'contact_email', contact_name: 'contact_name' }

export default function TaskCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const enabled = Boolean(orgId)
  const { active: taskTypes, byCode } = useTaskTypes(orgId)
  const { data: projects = [] } = useLookup(['projects', orgId, 'options'], ({ signal }) => projectsApi.options(orgId, { signal }), { enabled })

  const initialSubject = params.get('lead') ? 'lead' : 'project'
  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type_code: params.get('type') || 'task',
    subject_kind: initialSubject, // 'project' | 'lead' | 'none'
    project_id: params.get('project') || '',
    lead_id: params.get('lead') || '',
    owning_unit_id: '',
    assignee_user_id: '',
    reviewer_user_id: '',
    priority: 'p3',
    due_date: '',
    estimate: '',
    checklist: '',
    labels: '',
  })
  const [values, setValues] = useState({})
  const [problems, setProblems] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  // Leads only when the user may read them; otherwise the choice isn't offered.
  const leadsQuery = useQuery(
    ['leads', orgId, 'task-picker'],
    ({ signal }) => lookupsApi.leads(orgId, { limit: 100 }, { signal }).then((page) => page.data).catch(() => null),
    { enabled }
  )
  const leads = leadsQuery.data

  const taskType = byCode.get(form.task_type_code)
  const openProjects = projects.filter((p) => !['closed', 'cancelled'].includes(p.status))
  const chosenProject = form.subject_kind === 'project' ? projects.find((p) => p.id === form.project_id) : null
  const chosenLead = form.subject_kind === 'lead' ? (leads ?? []).find((l) => l.id === form.lead_id) : null
  // Precedence per Section 4.3:
  // 1. If project is chosen, the project dictates the vertical scope.
  //    If the project has no vertical, no vertical-specific fields should apply.
  // 2. Only standalone tasks (not under a project) inherit from the chosen owning team.
  const isProjectTask = form.subject_kind === 'project' && Boolean(form.project_id)
  const taskVerticalId = isProjectTask ? (chosenProject?.vertical?.id || null) : null
  const taskUnitId = isProjectTask ? null : (form.owning_unit_id || null)
  const fields = useTaskFields(orgId, taskType, taskUnitId, taskVerticalId)
  const createFields = fields.filter((f) => !f.required_on_submit)
  const people = names.people || [me].filter(Boolean)
  const estimateMinutes = parseDuration(form.estimate)
  const estimateInvalid = form.estimate.trim() !== '' && estimateMinutes === null
  const usesTime = (taskType?.estimation_unit ?? 'minutes') === 'minutes'
  const serverProblems = attributeErrors(error)
  const fieldErrors = { ...getFieldErrors(error), ...serverProblems, ...problems }

  function chooseLead(leadId) {
    set('lead_id', leadId)
    const lead = (leads ?? []).find((l) => l.id === leadId)
    if (!lead) return
    setValues((v) => {
      const filled = { ...v }
      for (const [key, leadKey] of Object.entries(FROM_LEAD)) {
        if (fields.some((f) => f.key === key) && isEmpty(filled[key]) && lead[leadKey]) filled[key] = lead[leadKey]
      }
      return filled
    })
    if (!form.title.trim() && taskType) set('title', `${taskType.name}: ${lead.contact_name || lead.company_name || lead.code}`)
  }

  function subjectOf() {
    if (form.subject_kind === 'project' && form.project_id) return { type: SUBJECT_TYPES.project, id: form.project_id }
    if (form.subject_kind === 'lead' && form.lead_id) return { type: SUBJECT_TYPES.lead, id: form.lead_id }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (estimateInvalid) return
    const found = checkFields(createFields, values)
    setProblems(found)
    if (Object.keys(found).length) return
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        title: form.title.trim(),
        task_type_code: form.task_type_code,
        owning_unit_id: owningUnitId,
        priority: form.priority,
        checklist: form.checklist.split('\n').map((line) => line.trim()).filter(Boolean).map((text) => ({ text })),
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
      }
      const subject = subjectOf()
      if (subject) body.subject = subject
      const attributes = toAttributes(createFields, values)
      if (Object.keys(attributes).length) body.attributes = attributes
      if (form.description.trim()) body.description = form.description.trim()
      if (form.assignee_user_id) body.assignee_user_id = form.assignee_user_id
      if (form.reviewer_user_id) body.reviewer_user_id = form.reviewer_user_id
      if (form.due_date) body.due_at = dueAtFromDate(form.due_date)
      if (usesTime && estimateMinutes) body.estimate_minutes = estimateMinutes
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

  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...taskTypes.map((t) => t.discipline)])].filter((d) => taskTypes.some((t) => t.discipline === d))
  const resolution = taskType?.resolution_sla_minutes?.[form.priority]
  const response = taskType?.response_sla_minutes?.[form.priority]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>New task</h1>
          {activeOrg && <p className="muted small" style={{ margin: '4px 0 0' }}>In “{activeOrg.name}”</p>}
        </div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      {error && Object.keys(getFieldErrors(error)).length === 0 && Object.keys(serverProblems).length === 0 && <ErrorBanner error={error} />}

      <form className="panel" onSubmit={handleSubmit}>
        <fieldset className="type-picker">
          <legend>What kind of work? *</legend>
          {disciplines.map((discipline) => (
            <div key={discipline} className="type-group">
              <div className="type-group-label"><span className={`discipline-dot ${discipline}`} /> {disciplineLabel(discipline)}</div>
              <div className="type-options">
                {taskTypes.filter((t) => t.discipline === discipline).map((t) => (
                  <label key={t.code} className={`type-option${form.task_type_code === t.code ? ' chosen' : ''}`}>
                    <input type="radio" name="task_type" value={t.code} checked={form.task_type_code === t.code} onChange={() => set('task_type_code', t.code)} />
                    {t.name}
                    {t.requires_review && <span className="muted small"> · reviewed</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="field">
          <label htmlFor="title">Title *</label>
          <input id="title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
          {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="subject_kind">About</label>
            <select id="subject_kind" value={form.subject_kind} onChange={(e) => set('subject_kind', e.target.value)}>
              <option value="project">A project</option>
              {leads && <option value="lead">A lead</option>}
              <option value="none">Nothing in particular (a to-do)</option>
            </select>
          </div>
          {form.subject_kind === 'project' && (
            <div className="field">
              <label htmlFor="project_id">Project *</label>
              <select id="project_id" required value={form.project_id} onChange={(e) => set('project_id', e.target.value)}>
                <option value="">— Choose —</option>
                {openProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.subject_kind === 'lead' && (
            <div className="field">
              <label htmlFor="lead_id">Lead *</label>
              <select id="lead_id" required value={form.lead_id} onChange={(e) => chooseLead(e.target.value)}>
                <option value="">— Choose —</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} · {l.contact_name || l.company_name || 'Lead'}{l.company_name && l.contact_name ? ` (${l.company_name})` : ''}</option>
                ))}
              </select>
              {chosenLead && <div className="hint">{[chosenLead.contact_email, chosenLead.contact_phone].filter(Boolean).join(' · ')}</div>}
            </div>
          )}
        </div>

        {createFields.length > 0 && (
          <div className="subpanel">
            <div className="subpanel-title">{taskType?.name} details</div>
            <TaskFieldInputs fields={createFields} values={values} onChange={setValues} errors={fieldErrors} />
            {fields.some((f) => f.required_on_submit) && (
              <p className="muted small" style={{ margin: 0 }}>
                Filled in when it's submitted: {fields.filter((f) => f.required_on_submit).map((f) => f.label).join(', ')}.
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="grid-3">
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
          <div className="field">
            <label htmlFor="due_date">Due</label>
            <input id="due_date" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            {resolution && !form.due_date && <div className="hint">Left empty: due when the {formatTarget(resolution)} SLA runs out.</div>}
          </div>
        </div>
        {(resolution || response) && (
          <p className="muted small" style={{ marginTop: -6 }}>
            {TASK_PRIORITY_LABELS[form.priority]} {taskType.name.toLowerCase()} SLA:
            {response ? ` pick up within ${formatTarget(response)}` : ''}{response && resolution ? ',' : ''}
            {resolution ? ` resolve within ${formatTarget(resolution)}` : ''}.
          </p>
        )}

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
          {usesTime ? (
            <div className="field">
              <label htmlFor="estimate">Estimate</label>
              <input id="estimate" placeholder="e.g. 2h 30m" value={form.estimate} onChange={(e) => set('estimate', e.target.value)} />
              {estimateInvalid && <div className="field-error">Write it like 90, 1h 30m or 1.5h.</div>}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="labels">Labels</label>
              <input id="labels" placeholder="Comma separated" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
            </div>
          )}
        </div>

        {usesTime && (
          <div className="field">
            <label htmlFor="labels">Labels</label>
            <input id="labels" placeholder="Comma separated" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
          </div>
        )}
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

        <button className="btn" type="submit" disabled={submitting || !taskType} aria-busy={submitting}>Create task</button>
      </form>
    </div>
  )
}
