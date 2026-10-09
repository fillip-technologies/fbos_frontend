import { useState } from 'react'
import { setupApi, workflowsApi } from '@/features/delivery/api.js'
import AssignmentPolicies from '@/features/delivery/components/AssignmentPolicies.jsx'
import DeliverySettings from '@/features/delivery/components/DeliverySettings.jsx'
import RoutingRules from '@/features/delivery/components/RoutingRules.jsx'
import {
  DISCIPLINES,
  DISCIPLINE_ORDER,
  ESTIMATION_UNITS,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  OUTCOME_KINDS,
  PRIORITIES,
  disciplineLabel,
  formatTarget,
} from '@/features/delivery/taskFields.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import { TASK_PRIORITY_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/
const RESERVED_KEYS = new Set([
  'labels', 'blocked_reason', 'blocked_by_task_id', 'outcome', 'follow_up_of', 'follow_up_task_id',
  'cadence_step', 'responded_at', 'due_from_sla', 'sla_paused_since', 'sla_paused_minutes',
])
const toKey = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 64)
let rowSeq = 0
const rowId = () => `row-${(rowSeq += 1)}`

// The kinds of work tasks can be: the built-in ones for each discipline, and the company's own.
// A type decides the fields its tasks carry, the outcomes they record, their SLA clocks and
// how their effort is estimated.
export default function TaskTypes() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canManage = hasAccess(me, ACCESS.deliverySetup)
  const { types, active, error, loading } = useTaskTypes(orgId)
  const names = useDeliveryNames(orgId)
  const [editing, setEditing] = useState(null) // { type?: existing, draft }
  const [showArchived, setShowArchived] = useState(false)

  // The company's published task workflows, for the types to follow (shared with the workflow panel's list).
  const { data: workflowDefinitions } = useQuery(
    ['workflow-definitions', orgId, 'task.task'],
    ({ signal }) => workflowsApi.definitions(orgId, { subject_type: 'task.task' }, { signal }),
    { enabled: Boolean(orgId) && canManage && hasAccess(me, ACCESS.workflows) }
  )
  const taskWorkflows = (workflowDefinitions ?? []).filter((d) => d.status === 'active' && d.current_version_no)
  const visible = types.filter((t) => showArchived || !t.archived)
  const disciplines = [...new Set([...DISCIPLINE_ORDER, ...visible.map((t) => t.discipline)])].filter((d) => visible.some((t) => t.discipline === d))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Task types</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            The kinds of work in {activeOrg ? `“${activeOrg.name}”` : 'this company'}: their fields, outcomes and SLAs.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {canManage && <button className="btn" onClick={() => setEditing({ draft: blankDraft() })}>+ New task type</button>}
        </div>
      </div>

      {canManage && <DeliverySettings orgId={orgId} />}
      {canManage && <RoutingRules orgId={orgId} names={names} taskTypes={active} />}
      {canManage && <AssignmentPolicies orgId={orgId} names={names} />}

      {editing && (
        <TaskTypeEditor
          key={editing.type?.id || 'new'}
          orgId={orgId}
          existing={editing.type}
          initial={editing.draft}
          onClose={() => setEditing(null)}
        />
      )}

      <ErrorBanner error={error} />
      <label className="inline-check" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      {loading ? (
        <PanelSkeleton />
      ) : (
        disciplines.map((discipline) => (
          <section key={discipline} className="panel">
            <h2 style={{ marginTop: 0, fontSize: 17 }}><span className={`discipline-dot ${discipline}`} /> {disciplineLabel(discipline)}</h2>
            <div className="type-cards">
              {visible.filter((t) => t.discipline === discipline).map((t) => (
                <TypeCard
                  key={t.id}
                  orgId={orgId}
                  type={t}
                  taskWorkflows={taskWorkflows}
                  canManage={canManage}
                  onEdit={() => setEditing({ type: t, draft: toDraft(t) })}
                  onCopy={() => setEditing({ draft: { ...toDraft(t), code: `${t.code}_custom`, name: `${t.name} (ours)` } })}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function TypeCard({ orgId, type, taskWorkflows, canManage, onEdit, onCopy }) {
  const sla = type.resolution_sla_minutes || type.response_sla_minutes
  return (
    <article className="type-card">
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong>{type.name}</strong>
        <span className="row-actions">
          {type.is_builtin && <StatusBadge status="inactive" label="Built in" />}
          {type.archived && <StatusBadge status="archived" label="Archived" />}
        </span>
      </div>
      <div className="mono muted">{type.code}</div>
      <div className="small" style={{ margin: '8px 0' }}>
        {ESTIMATION_UNITS[type.estimation_unit]}
        {type.requires_review && ' · reviewed'}
        {type.review_rounds_included && ` · ${type.review_rounds_included} rounds included`}
      </div>
      {type.fields.length > 0 && (
        <div className="chips">
          {type.fields.map((f) => (
            <span key={f.key} className="chip subtle" title={FIELD_TYPE_LABELS[f.type]}>
              {f.label}{f.required ? ' *' : f.required_on_submit ? ' (on submit)' : ''}
            </span>
          ))}
        </div>
      )}
      {type.outcomes.length > 0 && (
        <div className="small muted">Outcomes: {type.outcomes.map((o) => o.label + (o.follow_up_in_days != null ? ` → ${o.follow_up_in_days}d` : '')).join(', ')}</div>
      )}
      {sla && (
        <div className="small muted">
          SLA (urgent): {type.response_sla_minutes?.p1 ? `pick up ${formatTarget(type.response_sla_minutes.p1)}` : ''}
          {type.response_sla_minutes?.p1 && type.resolution_sla_minutes?.p1 ? ', ' : ''}
          {type.resolution_sla_minutes?.p1 ? `resolve ${formatTarget(type.resolution_sla_minutes.p1)}` : ''}
        </div>
      )}
      {canManage ? (
        <WorkflowPicker orgId={orgId} type={type} taskWorkflows={taskWorkflows} />
      ) : (
        type.workflow && <div className="small muted">Follows the “{type.workflow.name}” workflow</div>
      )}
      {canManage && (
        <div className="row-actions" style={{ marginTop: 10 }}>
          {!type.is_builtin && <button className="btn secondary small-btn" onClick={onEdit}>Edit</button>}
          <button className="btn secondary small-btn" onClick={onCopy}>{type.is_builtin ? 'Start from this' : 'Copy'}</button>
        </div>
      )}
    </article>
  )
}

// Which workflow the company's new tasks of the type follow: its stages then move them (and may
// hand them to other teams), in place of start, submit and review. Tasks already made keep theirs.
function WorkflowPicker({ orgId, type, taskWorkflows }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const current = type.workflow?.code ?? ''
  const offered = taskWorkflows.some((w) => w.code === current) || !current ? taskWorkflows : [...taskWorkflows, type.workflow]

  async function choose(code) {
    setBusy(true)
    setError(null)
    try {
      await setupApi.setTypeWorkflow(orgId, type.id, code || null)
      invalidate(['task-types', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (type.outcomes.length > 0 && !current) {
    return <div className="small muted" style={{ marginTop: 6 }}>Records outcomes, so it can’t follow a workflow yet.</div>
  }
  return (
    <div className="field" style={{ margin: '8px 0 0' }}>
      <label htmlFor={`workflow-${type.id}`} className="small">Follows workflow</label>
      <select id={`workflow-${type.id}`} value={current} disabled={busy} aria-busy={busy} onChange={(e) => choose(e.target.value)}>
        <option value="">— None: tasks move by their own actions —</option>
        {offered.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}
      </select>
      {taskWorkflows.length === 0 && !current && <div className="hint">No published task workflows yet.</div>}
      {type.is_builtin && taskWorkflows.length > 0 && (
        <div className="hint">A built-in type: every new task of it in this company follows the workflow, requests included.</div>
      )}
      <ErrorBanner error={error} />
    </div>
  )
}

function blankDraft() {
  return {
    code: '', codeEdited: false, name: '', discipline: 'general', estimation_unit: 'minutes', requires_review: false,
    default_estimate_minutes: '', review_rounds_included: '', archived: false, fields: [], outcomes: [],
    response: Object.fromEntries(PRIORITIES.map((p) => [p, ''])), resolution: Object.fromEntries(PRIORITIES.map((p) => [p, ''])),
  }
}

function toDraft(t) {
  return {
    code: t.code, codeEdited: true, name: t.name, discipline: t.discipline, estimation_unit: t.estimation_unit,
    requires_review: t.requires_review, default_estimate_minutes: t.default_estimate_minutes ?? '',
    review_rounds_included: t.review_rounds_included ?? '', archived: t.archived,
    fields: t.fields.map((f) => ({ ...f, id: rowId(), keyEdited: true, options: f.options.join(', ') })),
    outcomes: t.outcomes.map((o) => ({ ...o, id: rowId(), codeEdited: true, follow_up_in_days: o.follow_up_in_days ?? '' })),
    response: Object.fromEntries(PRIORITIES.map((p) => [p, t.response_sla_minutes?.[p] ?? ''])),
    resolution: Object.fromEntries(PRIORITIES.map((p) => [p, t.resolution_sla_minutes?.[p] ?? ''])),
  }
}

const splitOptions = (text) => [...new Set(text.split(',').map((o) => o.trim()).filter(Boolean))]
const slaMap = (values) => {
  const entries = PRIORITIES.filter((p) => String(values[p]).trim() !== '').map((p) => [p, Number(values[p])])
  return entries.length ? Object.fromEntries(entries) : null
}

// Problems in the draft before sending: { field: issue } plus per-row issues by row id.
function draftProblems(draft, isNew) {
  const problems = {}
  if (isNew && !KEY_PATTERN.test(draft.code)) problems.code = 'Start with a letter; use a–z, 0–9 and _.'
  if (!draft.name.trim()) problems.name = 'Enter a name.'
  if (!KEY_PATTERN.test(draft.discipline)) problems.discipline = 'Use a–z, 0–9 and _.'
  const keys = draft.fields.map((f) => f.key)
  for (const f of draft.fields) {
    if (!f.label.trim()) problems[f.id] = 'Enter a label.'
    else if (!KEY_PATTERN.test(f.key)) problems[f.id] = 'The key must start with a letter and use only a–z, 0–9 and _.'
    else if (RESERVED_KEYS.has(f.key)) problems[f.id] = `“${f.key}” is used by the system; choose another key.`
    else if (keys.filter((k) => k === f.key).length > 1) problems[f.id] = 'Two fields use this key.'
    else if (['choice', 'multi_choice'].includes(f.type) && splitOptions(f.options).length < 2) problems[f.id] = 'A choice list needs at least two options.'
  }
  const codes = draft.outcomes.map((o) => o.code)
  for (const o of draft.outcomes) {
    if (!o.label.trim()) problems[o.id] = 'Enter a label.'
    else if (!KEY_PATTERN.test(o.code)) problems[o.id] = 'The code must start with a letter and use only a–z, 0–9 and _.'
    else if (codes.filter((c) => c === o.code).length > 1) problems[o.id] = 'Two outcomes use this code.'
  }
  for (const kind of ['response', 'resolution']) {
    if (PRIORITIES.some((p) => String(draft[kind][p]).trim() !== '' && !(Number(draft[kind][p]) >= 1))) problems[kind] = 'Targets are whole minutes, at least 1.'
  }
  return problems
}

function toBody(draft, isNew) {
  const body = {
    name: draft.name.trim(),
    discipline: draft.discipline,
    estimation_unit: draft.estimation_unit,
    requires_review: draft.requires_review,
    default_estimate_minutes: draft.default_estimate_minutes === '' ? null : Number(draft.default_estimate_minutes),
    review_rounds_included: draft.review_rounds_included === '' ? null : Number(draft.review_rounds_included),
    fields: draft.fields.map((f) => ({
      key: f.key, label: f.label.trim(), type: f.type, required: f.required, required_on_submit: f.required_on_submit,
      options: ['choice', 'multi_choice'].includes(f.type) ? splitOptions(f.options) : [],
      help: f.help?.trim() || null, show_on_card: f.show_on_card,
    })),
    outcomes: draft.outcomes.map((o) => ({
      code: o.code, label: o.label.trim(), kind: o.kind, follow_up_in_days: o.follow_up_in_days === '' ? null : Number(o.follow_up_in_days),
    })),
    response_sla_minutes: slaMap(draft.response),
    resolution_sla_minutes: slaMap(draft.resolution),
  }
  if (isNew) {
    body.code = draft.code
    if (body.default_estimate_minutes === null) delete body.default_estimate_minutes
    if (body.review_rounds_included === null) delete body.review_rounds_included
  } else {
    body.archived = draft.archived
    if (body.default_estimate_minutes === null) delete body.default_estimate_minutes
  }
  return body
}

function TaskTypeEditor({ orgId, existing, initial, onClose }) {
  const isNew = !existing
  const [draft, setDraft] = useState(initial)
  const [problems, setProblems] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const fieldErrors = getFieldErrors(error)

  const setName = (name) => setDraft((d) => ({ ...d, name, ...(isNew && !d.codeEdited ? { code: toKey(name) } : {}) }))
  const updateRow = (list, id, changes) => setDraft((d) => ({ ...d, [list]: d[list].map((r) => (r.id === id ? { ...r, ...changes } : r)) }))
  const removeRow = (list, id) => setDraft((d) => ({ ...d, [list]: d[list].filter((r) => r.id !== id) }))
  const moveRow = (list, id, delta) =>
    setDraft((d) => {
      const rows = [...d[list]]
      const index = rows.findIndex((r) => r.id === id)
      const target = index + delta
      if (target < 0 || target >= rows.length) return d
      ;[rows[index], rows[target]] = [rows[target], rows[index]]
      return { ...d, [list]: rows }
    })

  async function save(e) {
    e.preventDefault()
    const found = draftProblems(draft, isNew)
    setProblems(found)
    if (Object.keys(found).length) return
    setError(null)
    setBusy(true)
    try {
      const body = toBody(draft, isNew)
      if (isNew) await setupApi.createTaskType(orgId, body)
      else await setupApi.updateTaskType(orgId, existing.id, body)
      invalidate(['task-types', orgId])
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const knownDiscipline = draft.discipline in DISCIPLINES
  return (
    <form className="panel" onSubmit={save}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>{isNew ? 'New task type' : `Edit “${existing.name}”`}</h2>
      <ErrorBanner error={Object.keys(fieldErrors).length ? null : error} />

      <div className="grid-3">
        <div className="field">
          <label htmlFor="tt_name">Name *</label>
          <input id="tt_name" required value={draft.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site survey" />
          {problems.name && <div className="field-error">{problems.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="tt_code">Code *</label>
          <input
            id="tt_code"
            className="mono-input"
            disabled={!isNew}
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value, codeEdited: true }))}
          />
          {(problems.code || fieldErrors.code) && <div className="field-error">{problems.code || fieldErrors.code}</div>}
          {isNew && <div className="hint">How tasks name their type; can't change later.</div>}
        </div>
        <div className="field">
          <label htmlFor="tt_discipline">Discipline</label>
          <select id="tt_discipline" value={knownDiscipline ? draft.discipline : '__own'} onChange={(e) => set('discipline', e.target.value === '__own' ? '' : e.target.value)}>
            {Object.entries(DISCIPLINES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            <option value="__own">Another one…</option>
          </select>
          {!knownDiscipline && (
            <input aria-label="Your discipline" style={{ marginTop: 6 }} placeholder="e.g. legal, hr, finance" value={draft.discipline} onChange={(e) => set('discipline', toKey(e.target.value) || e.target.value)} />
          )}
          {problems.discipline && <div className="field-error">{problems.discipline}</div>}
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="tt_unit">Effort is estimated in</label>
          <select id="tt_unit" value={draft.estimation_unit} onChange={(e) => set('estimation_unit', e.target.value)}>
            {Object.entries(ESTIMATION_UNITS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tt_estimate">Default estimate (minutes)</label>
          <input id="tt_estimate" type="number" min={1} value={draft.default_estimate_minutes} onChange={(e) => set('default_estimate_minutes', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tt_rounds">Review rounds included</label>
          <input id="tt_rounds" type="number" min={1} max={20} disabled={!draft.requires_review} value={draft.review_rounds_included} onChange={(e) => set('review_rounds_included', e.target.value)} />
          <div className="hint">Later rounds are flagged to the reviewer (agency revisions).</div>
        </div>
      </div>
      <div className="row-actions" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <label className="inline-check">
          <input type="checkbox" checked={draft.requires_review} onChange={(e) => set('requires_review', e.target.checked)} />
          Reviewed before it's done
        </label>
        {!isNew && (
          <label className="inline-check">
            <input type="checkbox" checked={draft.archived} onChange={(e) => set('archived', e.target.checked)} />
            Archived (keeps its tasks, takes no new ones)
          </label>
        )}
      </div>

      <div className="subpanel">
        <div className="subpanel-title">Fields</div>
        <p className="muted small" style={{ marginTop: 0 }}>What each task of this type carries. “Required” must be filled in to create the task, “on submit” before it can be submitted.</p>
        {draft.fields.map((f, index) => (
          <div key={f.id} className="editor-row">
            <div className="editor-row-main">
              <input aria-label="Label" placeholder="Label" value={f.label} onChange={(e) => updateRow('fields', f.id, { label: e.target.value, ...(f.keyEdited ? {} : { key: toKey(e.target.value) }) })} />
              <input aria-label="Key" className="mono-input" placeholder="key" value={f.key} onChange={(e) => updateRow('fields', f.id, { key: e.target.value, keyEdited: true })} />
              <select aria-label="Type" value={f.type} onChange={(e) => updateRow('fields', f.id, { type: e.target.value })}>
                {FIELD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {['choice', 'multi_choice'].includes(f.type) && (
                <input aria-label="Options" placeholder="Options, comma separated" value={f.options} onChange={(e) => updateRow('fields', f.id, { options: e.target.value })} />
              )}
            </div>
            <div className="editor-row-flags">
              <label className="inline-check"><input type="checkbox" checked={f.required} onChange={(e) => updateRow('fields', f.id, { required: e.target.checked })} />Required</label>
              <label className="inline-check"><input type="checkbox" checked={f.required_on_submit} onChange={(e) => updateRow('fields', f.id, { required_on_submit: e.target.checked })} />On submit</label>
              <label className="inline-check"><input type="checkbox" checked={f.show_on_card} onChange={(e) => updateRow('fields', f.id, { show_on_card: e.target.checked })} />On cards</label>
              <button type="button" className="btn secondary small-btn" disabled={index === 0} onClick={() => moveRow('fields', f.id, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn secondary small-btn" disabled={index === draft.fields.length - 1} onClick={() => moveRow('fields', f.id, 1)} aria-label="Move down">↓</button>
              <button type="button" className="btn danger-outline small-btn" onClick={() => removeRow('fields', f.id)}>Remove</button>
            </div>
            {problems[f.id] && <div className="field-error">{problems[f.id]}</div>}
          </div>
        ))}
        <button
          type="button"
          className="btn secondary small-btn"
          onClick={() => set('fields', [...draft.fields, { id: rowId(), key: '', keyEdited: false, label: '', type: 'text', required: false, required_on_submit: false, show_on_card: false, options: '', help: '' }])}
        >
          + Add a field
        </button>
      </div>

      <div className="subpanel">
        <div className="subpanel-title">Outcomes</div>
        <p className="muted small" style={{ marginTop: 0 }}>
          How a finished task turned out, chosen when it's submitted (a call's result, a ticket's resolution). With a follow-up, the next task is scheduled that many days later: that's how cadences run.
        </p>
        {draft.outcomes.map((o) => (
          <div key={o.id} className="editor-row">
            <div className="editor-row-main">
              <input aria-label="Outcome" placeholder="e.g. Left voicemail" value={o.label} onChange={(e) => updateRow('outcomes', o.id, { label: e.target.value, ...(o.codeEdited ? {} : { code: toKey(e.target.value) }) })} />
              <input aria-label="Code" className="mono-input" placeholder="code" value={o.code} onChange={(e) => updateRow('outcomes', o.id, { code: e.target.value, codeEdited: true })} />
              <select aria-label="Kind" value={o.kind} onChange={(e) => updateRow('outcomes', o.id, { kind: e.target.value })}>
                {Object.entries(OUTCOME_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input aria-label="Follow up after days" type="number" min={0} max={365} placeholder="Follow up in … days" value={o.follow_up_in_days} onChange={(e) => updateRow('outcomes', o.id, { follow_up_in_days: e.target.value })} />
            </div>
            <div className="editor-row-flags">
              <button type="button" className="btn danger-outline small-btn" onClick={() => removeRow('outcomes', o.id)}>Remove</button>
            </div>
            {problems[o.id] && <div className="field-error">{problems[o.id]}</div>}
          </div>
        ))}
        <button type="button" className="btn secondary small-btn" onClick={() => set('outcomes', [...draft.outcomes, { id: rowId(), code: '', codeEdited: false, label: '', kind: 'neutral', follow_up_in_days: '' }])}>
          + Add an outcome
        </button>
      </div>

      <div className="subpanel">
        <div className="subpanel-title">SLA targets (minutes)</div>
        <p className="muted small" style={{ marginTop: 0 }}>Pick up: until the task is started. Resolve: until it's done; without a due date of its own, the task is due then. Leave empty for no target.</p>
        <table className="sla-table">
          <thead>
            <tr><th /> {PRIORITIES.map((p) => <th key={p}>{TASK_PRIORITY_LABELS[p]}</th>)}</tr>
          </thead>
          <tbody>
            {[['response', 'Pick up within'], ['resolution', 'Resolve within']].map(([kind, label]) => (
              <tr key={kind}>
                <th scope="row">{label}</th>
                {PRIORITIES.map((p) => (
                  <td key={p}>
                    <input
                      aria-label={`${label}, ${TASK_PRIORITY_LABELS[p]}`}
                      type="number"
                      min={1}
                      value={draft[kind][p]}
                      onChange={(e) => set(kind, { ...draft[kind], [p]: e.target.value })}
                    />
                    {draft[kind][p] && <div className="hint">{formatTarget(Number(draft[kind][p]))}</div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(problems.response || problems.resolution) && <div className="field-error">{problems.response || problems.resolution}</div>}
      </div>

      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{isNew ? 'Create task type' : 'Save'}</button>
        <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
