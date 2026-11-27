import '@/features/delivery/task-types.css'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { lookupsApi, projectsApi, routingApi, tasksApi } from '@/features/delivery/api.js'
import AssigneeOptions from '@/features/delivery/components/AssigneeOptions.jsx'
import CustomFieldInputs from '@/shared/components/CustomFieldInputs.jsx'
import { CustomizeFormLink } from '@/features/verticals/components/CustomFieldsSection.jsx'
import { DISCIPLINE_ORDER, attributeErrors, disciplineLabel, formatTarget } from '@/features/delivery/taskFields.js'
import { checkFields, isEmpty, toAttributes } from '@/shared/utils/customFields.js'
import useTaskReviewers from '@/features/delivery/useTaskReviewers.js'
import useAssignablePeople from '@/features/delivery/useAssignablePeople.js'
import useAssignmentPolicies from '@/features/delivery/useAssignmentPolicies.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useMyTaskTypes from '@/features/delivery/useMyTaskTypes.js'
import useTaskTypes, { useTaskFields } from '@/features/delivery/useTaskTypes.js'
import { SUBJECT_TYPES, TASK_PRIORITY_LABELS, dueAtFromDate, parseDuration } from '@/features/delivery/utils.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
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
  // Task managers give work to teams and people; anyone else adds personal tasks (no team, just them).
  const canManage = hasAccess(me, ACCESS.manageTasks)
  const names = useDeliveryNames(orgId)
  const enabled = Boolean(orgId)
  const { active: taskTypes, byCode } = useTaskTypes(orgId)
  const { data: projects = [] } = useLookup(['projects', orgId, 'options'], ({ signal }) => projectsApi.options(orgId, { signal }), { enabled })

  const initialSubject = params.get('lead') ? 'lead' : (params.get('project') || canManage) ? 'project' : 'none'
  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type_code: params.get('type') || 'task',
    subject_kind: initialSubject, // 'project' | 'lead' | 'none'
    project_id: params.get('project') || '',
    lead_id: params.get('lead') || '',
    personal: !canManage || params.get('personal') === '1',
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
  // Which custom fields apply, by the rule delivery answers for saved tasks (custom_field_scope):
  // a task in a project takes the project's vertical (none when it has none) and no team;
  // any other task takes its team, and through it the team's verticals.
  const isProjectTask = form.subject_kind === 'project' && Boolean(form.project_id)
  const taskVerticalId = isProjectTask ? (chosenProject?.vertical?.id || null) : null
  // The team delivery's routing rules give this kind of work (for the project's vertical).
  const { data: routed } = useLookup(
    ['task-routing', orgId, form.task_type_code, taskVerticalId || 'none'],
    ({ signal }) => routingApi.route(orgId, form.task_type_code, taskVerticalId, { signal }),
    { enabled: enabled && Boolean(form.task_type_code) && (!isProjectTask || Boolean(chosenProject)) }
  )
  const routedUnitId = routed?.unit?.id || ''
  // A chosen team, else the one the rules give this work, else the project's delivering team;
  // none for a personal task.
  const owningUnitId = form.personal ? '' : (form.owning_unit_id || routedUnitId || chosenProject?.owning_unit?.id || '')
  const taskUnitId = isProjectTask ? null : (owningUnitId || null)
  const fields = useTaskFields(orgId, taskType, taskUnitId, taskVerticalId, form)
  const createFields = fields.filter((f) => !f.required_on_submit)
  // Reviewers may be anyone; the assignee is someone the task's team may give its work to.
  const people = names.people || [me].filter(Boolean)
  const assignable = useAssignablePeople(orgId, owningUnitId)
  // A personal task's reviewer: anyone else in the company.
  const reviewers = useTaskReviewers(orgId, form.personal)
  const givenOut = useAssignmentPolicies(orgId).givenOut(owningUnitId)
  const estimateMinutes = parseDuration(form.estimate)
  const estimateInvalid = form.estimate.trim() !== '' && estimateMinutes === null
  const usesTime = (taskType?.estimation_unit ?? 'minutes') === 'minutes'
  const serverProblems = attributeErrors(error)
  const fieldErrors = { ...getFieldErrors(error), ...serverProblems, ...problems }

  // Without a chosen team the rules may give the new kind of work another team, with other people.
  function chooseType(code) {
    setForm((f) => ({ ...f, task_type_code: code, ...(f.owning_unit_id ? {} : { assignee_user_id: '' }) }))
  }

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
        priority: form.priority,
        checklist: form.checklist.split('\n').map((line) => line.trim()).filter(Boolean).map((text) => ({ text })),
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
      }
      const subject = subjectOf()
      if (subject) body.subject = subject
      const attributes = toAttributes(createFields, values)
      if (Object.keys(attributes).length) body.attributes = attributes
      if (form.description.trim()) body.description = form.description.trim()
      // A personal task has no team: delivery makes it the creator's own, reviewed by whoever is named.
      if (!form.personal) {
        body.owning_unit_id = owningUnitId
        if (form.assignee_user_id) body.assignee_user_id = form.assignee_user_id
      }
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

  // Only the kinds of work for the person's own teams (an admin sees all); a type already chosen stays.
  const { types: myTypes, hiddenCount, reason: typesReason, teamName } = useMyTaskTypes(orgId, taskTypes, names.units)
  const offeredTypes = myTypes.some((t) => t.code === form.task_type_code) || !taskType ? myTypes : [...myTypes, taskType]
  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...offeredTypes.map((t) => t.discipline)])].filter((d) => offeredTypes.some((t) => t.discipline === d))
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

      <form className="panel tt-editor" onSubmit={handleSubmit}>
        {/* ---------------- 1. What ---------------- */}
        <section className="tt-block">
          <h3><span className="tt-step-no">1</span> What is the work?</h3>
          <fieldset className="type-picker">
            <legend>Kind of work *</legend>
            {disciplines.map((discipline) => (
              <div key={discipline} className="type-group">
                <div className="type-group-label"><span className={`discipline-dot ${discipline}`} /> {disciplineLabel(discipline)}</div>
                <div className="type-options">
                  {offeredTypes.filter((t) => t.discipline === discipline).map((t) => (
                    <label key={t.code} className={`type-option${form.task_type_code === t.code ? ' chosen' : ''}`}>
                      <input type="radio" name="task_type" value={t.code} checked={form.task_type_code === t.code} onChange={() => chooseType(t.code)} />
                      {t.name}
                      {t.requires_review && <span className="muted small"> · reviewed</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {typesReason === 'admin' && <p className="muted small" style={{ margin: '10px 0 0' }}>You can set up work, so every kind of work is shown.</p>}
            {typesReason === 'no-team' && (
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                You are not placed in a team yet, so every kind of work is shown. An admin sets your team under Users → your page → Home unit.
              </p>
            )}
            {typesReason === 'no-rule' && (
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                Your team{teamName ? ' (' + teamName + ')' : ''} has no “Who gets the work” rule yet, so every kind of work is shown. An admin adds one under Settings → Task types.
              </p>
            )}
            {hiddenCount > 0 && (
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                Only your own team’s kinds of work are shown. Need something from another team?{' '}
                {hasAccess(me, ACCESS.requestWork) ? <Link to="/requests/new">Ask that team</Link> : 'Ask your team head or an admin.'}
              </p>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor="title">Give it a title *</label>
            <input id="title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Instagram post for Ejaz Hospital, 5 Dec" />
            {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
          </div>

          {createFields.length > 0 && (
            <div className="subpanel">
              <div className="subpanel-head">
                <div className="subpanel-title">{taskType?.name} details</div>
                <CustomizeFormLink formCode="task.task" />
              </div>
              <CustomFieldInputs fields={createFields} values={values} onChange={setValues} errors={fieldErrors} />
              {fields.some((f) => f.required_on_submit) && (
                <p className="muted small" style={{ margin: 0 }}>
                  Filled in when it's submitted: {fields.filter((f) => f.required_on_submit).map((f) => f.label).join(', ')}.
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="description">More about it <span className="muted">(optional)</span></label>
            <textarea id="description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </section>

        {/* ---------------- 2. Who ---------------- */}
        <section className="tt-block">
          <h3><span className="tt-step-no">2</span> Who does it?</h3>
          {canManage && (
            <div className="segmented tc-who" role="group" aria-label="Who is it for">
              <button type="button" className={!form.personal ? 'active' : ''} aria-pressed={!form.personal} onClick={() => setForm((f) => ({ ...f, personal: false, assignee_user_id: '' }))}>A team</button>
              <button type="button" className={form.personal ? 'active' : ''} aria-pressed={form.personal} onClick={() => setForm((f) => ({ ...f, personal: true, owning_unit_id: '', assignee_user_id: '' }))}>Just me</button>
            </div>
          )}

          {form.personal ? (
            <p className="muted small" style={{ margin: '8px 0 0' }}>A personal to-do: it is yours, and no team sees it in their queue.</p>
          ) : (
            <>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="owning_unit_id">Which team? *</label>
                  <select id="owning_unit_id" required value={owningUnitId} onChange={(e) => setForm((f) => ({ ...f, owning_unit_id: e.target.value, assignee_user_id: '' }))}>
                    <option value="">Choose the team…</option>
                    {(names.units || []).filter((u) => u.status !== 'inactive').map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {!form.owning_unit_id && routedUnitId && <div className="hint">Filled in from “Who gets the work” for this kind of work.</div>}
                </div>
                <div className="field">
                  <label htmlFor="assignee_user_id">Which person? <span className="muted">(optional)</span></label>
                  <select id="assignee_user_id" value={form.assignee_user_id} onChange={(e) => set('assignee_user_id', e.target.value)}>
                    <option value="">{givenOut ? 'Let the team give it out' : 'Leave it for the team to pick up'}</option>
                    <AssigneeOptions people={assignable.people} me={me} />
                  </select>
                  {!owningUnitId && <div className="hint">Choose the team first to see its people.</div>}
                  {assignable.teamOnly && <div className="hint">Only people in this team can be given its tasks.</div>}
                  {assignable.error && <div className="hint">The team’s people couldn’t be loaded, so only you are offered. Try again shortly.</div>}
                </div>
              </div>
              {owningUnitId && (
                <p className="tc-summary">
                  Goes to <strong>{names.unitName(owningUnitId)}</strong>
                  {form.assignee_user_id
                    ? <>, and is given to <strong>{names.personName(form.assignee_user_id)}</strong>.</>
                    : givenOut
                      ? <>. Not given to anyone yet: {givenOut}.</>
                      : <>. Nobody is named, so it waits in the team’s queue until someone takes it.</>}
                </p>
              )}
            </>
          )}
        </section>

        {/* ---------------- 3. When ---------------- */}
        <section className="tt-block">
          <h3><span className="tt-step-no">3</span> When, and what is it for?</h3>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="due_date">Due date</label>
              <input id="due_date" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
              {resolution && !form.due_date && <div className="hint">Left empty: due when the {formatTarget(resolution)} time limit runs out.</div>}
            </div>
            <div className="field">
              <label htmlFor="priority">How urgent</label>
              <select id="priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subject_kind">Linked to</label>
              <select id="subject_kind" value={form.subject_kind} onChange={(e) => set('subject_kind', e.target.value)}>
                <option value="project">A project</option>
                {leads && <option value="lead">A lead</option>}
                <option value="none">Nothing (a plain to-do)</option>
              </select>
            </div>
          </div>
          {(resolution || response) && (
            <p className="muted small" style={{ marginTop: 0 }}>
              Time limit for {TASK_PRIORITY_LABELS[form.priority]} {taskType.name.toLowerCase()}:
              {response ? ` start within ${formatTarget(response)}` : ''}{response && resolution ? ',' : ''}
              {resolution ? ` finish within ${formatTarget(resolution)}` : ''}.
            </p>
          )}
          {form.subject_kind === 'project' && (
            <div className="field">
              <label htmlFor="project_id">Which project? *</label>
              <select id="project_id" required value={form.project_id} onChange={(e) => set('project_id', e.target.value)}>
                <option value="">Choose the project…</option>
                {openProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.subject_kind === 'lead' && (
            <div className="field">
              <label htmlFor="lead_id">Which lead? *</label>
              <select id="lead_id" required value={form.lead_id} onChange={(e) => chooseLead(e.target.value)}>
                <option value="">Choose the lead…</option>
                {(leads ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} · {l.contact_name || l.company_name || 'Lead'}{l.company_name && l.contact_name ? ` (${l.company_name})` : ''}</option>
                ))}
              </select>
              {chosenLead && <div className="hint">{[chosenLead.contact_email, chosenLead.contact_phone].filter(Boolean).join(' · ')}</div>}
            </div>
          )}
        </section>

        {/* ---------------- More ---------------- */}
        <details className="tt-block tt-more">
          <summary>More options <small>(you can skip these)</small></summary>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="reviewer_user_id">Who checks it?</label>
              {form.personal ? (
                <>
                  <select id="reviewer_user_id" value={form.reviewer_user_id} onChange={(e) => set('reviewer_user_id', e.target.value)}>
                    <option value="">{taskType?.requires_review ? 'Choose when handing it in' : 'No one'}</option>
                    {reviewers.people.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <div className="hint">
                    {taskType?.requires_review ? 'This kind of task goes for review: name who checks it now, or when you hand it in.' : 'Optional: someone checks it before it counts as done.'}
                  </div>
                  {reviewers.error && <div className="hint">The company’s people couldn’t be loaded. Try again shortly.</div>}
                </>
              ) : (
                <select id="reviewer_user_id" value={form.reviewer_user_id} onChange={(e) => set('reviewer_user_id', e.target.value)}>
                  <option value="">Anyone allowed to review</option>
                  {people.map((u) => (
                    <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
                  ))}
                </select>
              )}
              {!form.personal && form.reviewer_user_id && taskType && !taskType.requires_review && (
                <div className="alert warn" style={{ marginTop: 6 }}>
                  “{taskType.name}” is not set to be checked, so this task will be marked done as soon as it is handed in, without waiting
                  for this person. An admin can turn on “Someone checks it before it counts as done” for it under Task types.
                </div>
              )}
            </div>
            {usesTime && (
              <div className="field">
                <label htmlFor="estimate">How long will it take?</label>
                <input id="estimate" placeholder="e.g. 2h 30m" value={form.estimate} onChange={(e) => set('estimate', e.target.value)} />
                {estimateInvalid && <div className="field-error">Write it like 90, 1h 30m or 1.5h.</div>}
              </div>
            )}
            <div className="field">
              <label htmlFor="labels">Tags</label>
              <input id="labels" placeholder="Separated by commas" value={form.labels} onChange={(e) => set('labels', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="checklist">Steps to tick</label>
            <textarea
              id="checklist"
              rows={3}
              placeholder="One step per line. Each must be ticked before the task is handed in."
              value={form.checklist}
              onChange={(e) => set('checklist', e.target.value)}
            />
          </div>
        </details>

        <div className="row-actions tt-save">
          <button className="btn" type="submit" disabled={submitting || !taskType} aria-busy={submitting}>Create task</button>
          <button className="btn secondary" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
