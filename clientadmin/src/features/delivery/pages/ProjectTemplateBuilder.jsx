import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { setupApi, workflowsApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { SUBJECT_TYPES, formatDateTime, toUpperCode } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

let rowSeq = 0
const rowId = () => `row-${(rowSeq += 1)}`

// A project template's phases, milestones, work packages and workflow, changed and published as
// its next version. New projects copy the latest published version; projects already made keep
// what they copied. What this page doesn't show (phase dates, milestone weights) is kept.
export default function ProjectTemplateBuilder() {
  const { code } = useParams()
  const { orgId } = useActiveOrg()
  const { user: me } = useAuth()
  const enabled = Boolean(orgId)
  const names = useDeliveryNames(orgId)
  // Listing workflows is its own permission: without it the template's workflow stays as it is.
  const canReadWorkflows = hasAccess(me, ACCESS.workflows)
  const workflows = useQuery(
    ['workflow-definitions', orgId, SUBJECT_TYPES.project],
    ({ signal }) => workflowsApi.definitions(orgId, { subject_type: SUBJECT_TYPES.project }, { signal }),
    { enabled: enabled && canReadWorkflows }
  )
  const templates = useQuery(['project-templates', orgId], ({ signal }) => setupApi.templates(orgId, { signal }), { enabled })
  const versions = useQuery(
    ['project-template-versions', orgId, code],
    ({ signal }) => setupApi.templateVersions(orgId, code, { signal }),
    { enabled }
  )
  const { data: types = [] } = useLookup(['project-types', orgId], ({ signal }) => setupApi.projectTypes(orgId, { signal }), { enabled })
  // Kept here, not in the editor: publishing reloads the versions, which starts a fresh editor.
  const [notice, setNotice] = useState('')

  const template = (templates.data ?? []).find((t) => t.code === code)
  // Just created: the cached list doesn't have it until its refetch lands.
  if (templates.loading || versions.loading || (!template && templates.fetching)) return <PanelSkeleton />
  if (!template) {
    return <ErrorBanner error={templates.error || versions.error || { message: 'This project template doesn’t exist in this company.' }} />
  }
  const all = versions.data ?? []
  // Versions come newest first. Starting from the newest, even a draft, picks up where someone left off.
  const start = all[0] ?? null
  const typeName = types.find((t) => t.code === template.work_unit_type_code)?.name || template.work_unit_type_code

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {template.name} {template.status === 'retired' && <StatusBadge status="retired" label="Retired" />}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Project template <span className="mono">{template.code}</span> · for {typeName.toLowerCase()} projects
            {template.vertical && ` · ${names.verticalName(template.vertical)}`}
            {template.published_version_no ? ` · version ${template.published_version_no} is in use` : ' · not published yet'}
          </p>
        </div>
        <Link className="btn secondary" to="/project-templates">Back to templates</Link>
      </div>
      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={versions.error} onRetry={versions.reload} />

      <TemplateSettings key={`${template.name}|${template.vertical?.id ?? ''}`} orgId={orgId} template={template} names={names} />
      <Editor
        key={`${code}-${start?.version_no || 0}`}
        orgId={orgId}
        template={template}
        start={start}
        names={names}
        workflows={{ canRead: canReadWorkflows, data: workflows.data ?? null, error: workflows.error, reload: workflows.reload }}
        onEdit={() => setNotice('')}
        onPublished={(versionNo) =>
          setNotice(
            template.status === 'retired'
              ? `Version ${versionNo} published. The template is retired: no new project uses it until it’s made active again.`
              : `Version ${versionNo} published. New projects made from “${template.name}” start with it; projects already made keep theirs.`
          )
        }
      />
      <VersionHistory versions={all} inUse={template.published_version_no} />
    </div>
  )
}

const asList = (value) => (Array.isArray(value) ? value : [])
const bySeq = (a, b) => (a.seq ?? 0) - (b.seq ?? 0)

// The version's structure as editor rows. Milestones and packages point at a phase row, not a
// number, so phases can be moved and removed; `item` keeps every field the page doesn't show.
function fromStructure(structure) {
  const phaseRowBySeq = new Map()
  const phases = [...asList(structure.phases)].sort(bySeq).map((item) => {
    const row = { id: rowId(), name: item.name ?? '', item }
    // As the backend copies them: a phase without a seq is phase 0.
    phaseRowBySeq.set(item.seq ?? 0, row.id)
    return row
  })
  const phaseRow = (phaseSeq) => (phaseSeq == null ? '' : phaseRowBySeq.get(phaseSeq) ?? '')
  const milestones = [...asList(structure.milestones)].sort(bySeq).map((item) => ({
    id: rowId(),
    name: item.name ?? '',
    code: item.code ?? '',
    codeEdited: true,
    phase: phaseRow(item.phase_seq),
    offset: Number.isInteger(item.offset_days) && item.offset_days >= 0 ? String(item.offset_days) : '',
    // A fixed date (only the API sets one) wins over the days; typing days replaces it.
    fixed: typeof item.planned_date === 'string' ? item.planned_date : null,
    is_billing_milestone: Boolean(item.is_billing_milestone),
    requires_client_acceptance: Boolean(item.requires_client_acceptance),
    item,
  }))
  const packages = asList(structure.packages).map((item) => ({
    id: rowId(),
    name: typeof item.name === 'string' ? item.name : '',
    phase: phaseRow(item.phase_seq),
    hours: typeof item.estimated_hours === 'number' && item.estimated_hours > 0 ? String(item.estimated_hours) : '',
    unit: typeof item.owner_unit_id === 'string' ? item.owner_unit_id : '',
    item,
  }))
  return { phases, milestones, packages }
}

// Editor rows back to a structure: phases numbered 1..n in their order, and everything that
// points at a phase (milestones, work packages) pointed at its new number.
function toStructure(original, phases, milestones, packages) {
  const seqByRow = new Map(phases.map((p, i) => [p.id, i + 1]))
  const inPhase = (item, row) => {
    const out = { ...item }
    delete out.phase_seq
    if (seqByRow.has(row)) out.phase_seq = seqByRow.get(row)
    return out
  }
  const structure = {
    ...original,
    phases: phases.map((p, i) => ({ ...p.item, seq: i + 1, name: p.name.trim() })),
    milestones: milestones.map((m, i) =>
      inPhase(
        {
          ...withoutDates(m.item),
          ...(m.fixed ? { planned_date: m.fixed } : {}),
          ...(m.offset !== '' ? { offset_days: Number(m.offset) } : {}),
          seq: i + 1,
          code: m.code.trim(),
          name: m.name.trim(),
          is_billing_milestone: m.is_billing_milestone,
          requires_client_acceptance: m.requires_client_acceptance,
        },
        m.phase
      )
    ),
  }
  if (packages.length > 0 || Array.isArray(original.packages)) {
    structure.packages = packages.map((p) => {
      const out = inPhase({ ...p.item, name: p.name.trim() }, p.phase)
      delete out.estimated_hours
      delete out.owner_unit_id
      if (p.hours !== '') out.estimated_hours = Number(p.hours)
      if (p.unit) out.owner_unit_id = p.unit
      return out
    })
  }
  return structure
}

function withoutDates(item) {
  const out = { ...item }
  delete out.planned_date
  delete out.offset_days
  return out
}

// What would make a template that projects can't use, said before publishing.
function problems(phases, milestones, packages, workflowGone) {
  const found = []
  if (phases.length === 0 && milestones.length === 0 && packages.length === 0) {
    found.push('Add at least one phase, milestone or work package.')
  }
  if (phases.some((p) => !p.name.trim())) found.push('Every phase needs a name.')
  if (milestones.some((m) => !m.name.trim())) found.push('Every milestone needs a name.')
  const codes = milestones.map((m) => m.code.trim())
  if (codes.some((c) => !c)) found.push('Every milestone needs a code.')
  if (new Set(codes).size !== codes.length) found.push('Two milestones have the same code.')
  if (milestones.some((m) => m.offset !== '' && !/^\d{1,4}$/.test(m.offset))) {
    found.push('Days after the start are whole numbers: 0 for the day it starts, up to 9999.')
  }
  if (packages.some((p) => !p.name.trim())) found.push('Every work package needs a name.')
  if (packages.some((p) => p.hours !== '' && !/^\d{1,6}(\.\d{1,2})?$/.test(p.hours))) {
    found.push('Hours are a number from 0 to 999999, with at most two decimals.')
  }
  if (workflowGone) found.push('The workflow chosen can’t be started any more: choose another, or none.')
  return found
}

function uniqueCode(base, taken) {
  if (!base) return ''
  let candidate = base
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}-${n}`
  return candidate
}

function moveRow(rows, id, delta) {
  const from = rows.findIndex((r) => r.id === id)
  const to = from + delta
  if (to < 0 || to >= rows.length) return rows
  const next = [...rows]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

function Editor({ orgId, template, start, names, workflows, onEdit, onPublished }) {
  const original = start?.structure ?? {}
  const [initial] = useState(() => fromStructure(original))
  const [phases, setPhases] = useState(initial.phases)
  const [milestones, setMilestones] = useState(initial.milestones)
  const [packages, setPackages] = useState(initial.packages)
  const [workflow, setWorkflow] = useState(start?.workflow_definition_code ?? '')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Only an active project workflow with a published version can start with a project. A
  // choice that no longer is one (retired, or set through the API) is known once the list is in.
  const workflowList = workflows.canRead ? workflows.data : null
  const usable = (workflowList ?? []).filter((d) => d.status === 'active' && d.current_version_no)
  const workflowGone = Boolean(workflow && workflowList && !usable.some((d) => d.code === workflow))
  const workflowIssue = (error?.details?.detail?.details ?? []).find((d) => d.field === 'workflow_definition_code')?.issue
  const units = (names.units || []).filter((u) => u.status !== 'inactive')
  const found = problems(phases, milestones, packages, workflowGone)
  // An unchanged draft is published as it is; anything else becomes the next version first.
  const reuseDraft = !dirty && start?.status === 'draft'
  const canPublish = found.length === 0 && (dirty || reuseDraft)
  const nextVersionNo = reuseDraft ? start.version_no : (start?.version_no ?? 0) + 1

  function touch() {
    setDirty(true)
    onEdit()
  }
  const setPhase = (id, changes) => {
    touch()
    setPhases((all) => all.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }
  const setMilestone = (id, changes) => {
    touch()
    setMilestones((all) => all.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }
  const setPackage = (id, changes) => {
    touch()
    setPackages((all) => all.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }

  function addPhase() {
    touch()
    setPhases((all) => [...all, { id: rowId(), name: '', item: {} }])
  }

  function removePhase(id) {
    touch()
    setPhases((all) => all.filter((p) => p.id !== id))
    setMilestones((all) => all.map((m) => (m.phase === id ? { ...m, phase: '' } : m)))
    setPackages((all) => all.map((p) => (p.phase === id ? { ...p, phase: '' } : p)))
  }

  function addMilestone() {
    touch()
    setMilestones((all) => [
      ...all,
      { id: rowId(), name: '', code: '', codeEdited: false, phase: '', offset: '', fixed: null, is_billing_milestone: false, requires_client_acceptance: false, item: {} },
    ])
  }

  function addPackage() {
    touch()
    setPackages((all) => [...all, { id: rowId(), name: '', phase: '', hours: '', unit: '', item: {} }])
  }

  function renameMilestone(milestone, name) {
    const taken = new Set(milestones.filter((m) => m.id !== milestone.id).map((m) => m.code))
    setMilestone(milestone.id, { name, ...(milestone.codeEdited ? {} : { code: uniqueCode(toUpperCode(name), taken) }) })
  }

  function move(setter, id, delta) {
    touch()
    setter((rows) => moveRow(rows, id, delta))
  }

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      let versionNo = start?.version_no
      if (!reuseDraft) {
        const draft = await setupApi.createTemplateVersion(orgId, template.code, {
          structure: toStructure(original, phases, milestones, packages),
          ...(workflow ? { workflow_definition_code: workflow } : {}),
        })
        versionNo = draft.version_no
      }
      await setupApi.publishTemplateVersion(orgId, template.code, versionNo)
      invalidate(['project-templates', orgId])
      invalidate(['project-template-versions', orgId, template.code])
      onPublished(versionNo)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {start?.status === 'draft' && (
        <div className="alert info">Version {start.version_no} is a draft that was never published. Publish it as it is, or change it first.</div>
      )}
      <ErrorBanner error={error} />

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Phases</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          The stages of the work, in order. Optional: a template can be milestones only.
        </p>
        {phases.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Phase</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {phases.map((p, i) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td>{i + 1}</td>
                    <td>
                      <input aria-label="Phase name" placeholder="e.g. Design" maxLength={255} value={p.name} onChange={(e) => setPhase(p.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn secondary small-btn" disabled={i === 0} onClick={() => move(setPhases, p.id, -1)} aria-label="Move up">↑</button>
                        <button type="button" className="btn secondary small-btn" disabled={i === phases.length - 1} onClick={() => move(setPhases, p.id, 1)} aria-label="Move down">↓</button>
                        <button type="button" className="btn danger-outline small-btn" onClick={() => removePhase(p.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addPhase}>+ Add a phase</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Milestones</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          What each project made from this template must deliver, in order. Each is planned that many days after the project
          starts (never after it is due), or for its due date when left empty.
        </p>
        {milestones.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Milestone</th>
                  <th>Code</th>
                  <th>Phase</th>
                  <th>Days after start</th>
                  <th>Invoiced on completion</th>
                  <th>Customer signs off</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={m.id} style={{ cursor: 'default' }}>
                    <td>{i + 1}</td>
                    <td>
                      <input aria-label="Milestone name" placeholder="e.g. Designs approved" maxLength={255} value={m.name} onChange={(e) => renameMilestone(m, e.target.value)} />
                    </td>
                    <td>
                      <input
                        aria-label="Milestone code"
                        className="mono-input"
                        maxLength={100}
                        value={m.code}
                        onChange={(e) => setMilestone(m.id, { code: e.target.value, codeEdited: true })}
                      />
                    </td>
                    <td>
                      <select aria-label="Phase" value={m.phase} onChange={(e) => setMilestone(m.id, { phase: e.target.value })}>
                        <option value="">— None —</option>
                        {phases.map((p, n) => <option key={p.id} value={p.id}>{p.name.trim() || `Phase ${n + 1}`}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="Days after the project starts"
                        type="number"
                        min={0}
                        max={9999}
                        step={1}
                        placeholder="Due date"
                        style={{ width: 100 }}
                        value={m.offset}
                        onChange={(e) => setMilestone(m.id, { offset: e.target.value, ...(e.target.value !== '' ? { fixed: null } : {}) })}
                      />
                      {m.fixed && <div className="hint">Fixed to {formatDate(m.fixed)}; typing days replaces it.</div>}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Invoiced on completion"
                        checked={m.is_billing_milestone}
                        onChange={(e) => setMilestone(m.id, { is_billing_milestone: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Customer signs off"
                        checked={m.requires_client_acceptance}
                        onChange={(e) => setMilestone(m.id, { requires_client_acceptance: e.target.checked })}
                      />
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn secondary small-btn" disabled={i === 0} onClick={() => move(setMilestones, m.id, -1)} aria-label="Move up">↑</button>
                        <button type="button" className="btn secondary small-btn" disabled={i === milestones.length - 1} onClick={() => move(setMilestones, m.id, 1)} aria-label="Move down">↓</button>
                        <button
                          type="button"
                          className="btn danger-outline small-btn"
                          onClick={() => {
                            touch()
                            setMilestones((all) => all.filter((x) => x.id !== m.id))
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addMilestone}>+ Add a milestone</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Work packages</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Chunks of the work, each with the hours it should take and, if another team does it, that team. Optional.
        </p>
        {packages.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Phase</th>
                  <th>Hours</th>
                  <th>Team</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td>
                      <input aria-label="Package name" placeholder="e.g. Home page" maxLength={255} value={p.name} onChange={(e) => setPackage(p.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <select aria-label="Phase" value={p.phase} onChange={(e) => setPackage(p.id, { phase: e.target.value })}>
                        <option value="">— None —</option>
                        {phases.map((ph, n) => <option key={ph.id} value={ph.id}>{ph.name.trim() || `Phase ${n + 1}`}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label="Hours"
                        type="number"
                        min={0}
                        step="0.25"
                        placeholder="—"
                        style={{ width: 100 }}
                        value={p.hours}
                        onChange={(e) => setPackage(p.id, { hours: e.target.value })}
                      />
                    </td>
                    <td>
                      <select aria-label="Team" value={p.unit} onChange={(e) => setPackage(p.id, { unit: e.target.value })}>
                        <option value="">— The project’s team —</option>
                        {p.unit && !units.some((u) => u.id === p.unit) && <option value={p.unit}>{names.unitName(p.unit)}</option>}
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn danger-outline small-btn"
                          onClick={() => {
                            touch()
                            setPackages((all) => all.filter((x) => x.id !== p.id))
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addPackage}>+ Add a work package</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Workflow</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          The stages each project made from this template goes through. The New project form offers to start it with the
          project. Project workflows are made under Project workflows on the <Link to="/project-templates">templates page</Link>.
        </p>
        {!workflows.canRead ? (
          workflow ? (
            <p className="small" style={{ marginBottom: 0 }}>
              Starts <span className="mono">{workflow}</span>. It stays as it is: seeing workflows needs workflow access.
            </p>
          ) : (
            <p className="muted small" style={{ marginBottom: 0 }}>None. Choosing one needs access to workflows.</p>
          )
        ) : workflows.error ? (
          <ErrorBanner error={workflows.error} onRetry={workflows.reload} />
        ) : workflowList ? (
          <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
            <label htmlFor="tpl_workflow">Starts with each new project</label>
            <select
              id="tpl_workflow"
              value={workflow}
              onChange={(e) => {
                touch()
                setWorkflow(e.target.value)
              }}
            >
              <option value="">— No workflow —</option>
              {workflowGone && <option value={workflow}>{workflow} (can’t be started any more)</option>}
              {usable.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
            {(workflowIssue || workflowGone) && (
              <div className="field-error">{workflowIssue || 'It is retired or has no published version.'}</div>
            )}
            {usable.length === 0 && !workflow && <div className="hint">No project workflow is published yet.</div>}
          </div>
        ) : null}
        {workflowIssue && !workflowList && <div className="field-error">{workflowIssue}</div>}
      </div>

      {(dirty || reuseDraft) && found.length > 0 && (
        <div className="alert warn">
          {found.map((p) => <div key={p}>{p}</div>)}
        </div>
      )}
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button className="btn" disabled={busy || !canPublish} aria-busy={busy} onClick={publish}>
          Publish as version {nextVersionNo}
        </button>
        {!dirty && !start && <span className="muted small">Add its phases, milestones and work packages, then publish.</span>}
        {!dirty && start && !reuseDraft && <span className="muted small">Change something to publish a new version.</span>}
      </div>
    </>
  )
}

// The template itself: its name, its vertical, and whether new projects may start from it.
function TemplateSettings({ orgId, template, names }) {
  const [form, setForm] = useState({ name: template.name, vertical_id: template.vertical?.id ?? '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const retired = template.status === 'retired'
  const changed = form.name.trim() !== template.name || form.vertical_id !== (template.vertical?.id ?? '')

  async function update(body, which) {
    setBusy(which)
    setError(null)
    try {
      await setupApi.updateTemplate(orgId, template.code, body)
      invalidate(['project-templates', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy('')
    }
  }

  function save(e) {
    e.preventDefault()
    update({ name: form.name.trim(), vertical_id: form.vertical_id || null }, 'save')
  }

  return (
    <form className="panel" onSubmit={save}>
      {retired && (
        <div className="alert warn">
          Retired: the New project form doesn’t offer it. Projects already made from it keep their phases and milestones.
        </div>
      )}
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="tpl_name">Name *</label>
          <input id="tpl_name" required maxLength={255} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="tpl_vertical">Vertical</label>
          <select id="tpl_vertical" value={form.vertical_id} onChange={(e) => setForm((f) => ({ ...f, vertical_id: e.target.value }))}>
            <option value="">— Any —</option>
            {template.vertical && !(names.verticals || []).some((v) => v.id === template.vertical.id) && (
              <option value={template.vertical.id}>{names.verticalName(template.vertical)}</option>
            )}
            {(names.verticals || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={!changed || !form.name.trim() || Boolean(busy)} aria-busy={busy === 'save'}>Save</button>
        <button
          type="button"
          className={retired ? 'btn secondary' : 'btn danger-outline'}
          disabled={Boolean(busy)}
          aria-busy={busy === 'status'}
          onClick={() => update({ status: retired ? 'active' : 'retired' }, 'status')}
        >
          {retired ? 'Make active again' : 'Retire'}
        </button>
        {!retired && <span className="muted small">Retiring stops new projects from using it; nothing else changes.</span>}
      </div>
    </form>
  )
}

function VersionHistory({ versions, inUse }) {
  if (versions.length === 0) return null
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Versions</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        New projects copy the version in use. A project keeps what it copied, whatever happens to the template later.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Published</th>
              <th>Phases</th>
              <th>Milestones</th>
              <th>Work packages</th>
              <th>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} style={{ cursor: 'default' }}>
                <td>
                  {v.version_no}
                  {v.version_no === inUse && <span className="muted small"> · in use</span>}
                </td>
                <td><StatusBadge status={v.status} label={v.status === 'published' ? 'Published' : v.status === 'draft' ? 'Draft' : 'Retired'} /></td>
                <td>{formatDateTime(v.published_at)}</td>
                <td>{asList(v.structure?.phases).length}</td>
                <td>{asList(v.structure?.milestones).length}</td>
                <td>{asList(v.structure?.packages).length}</td>
                <td>{v.workflow_definition_code ? <span className="mono">{v.workflow_definition_code}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
