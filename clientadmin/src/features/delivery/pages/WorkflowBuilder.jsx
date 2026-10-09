import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { workflowsApi } from '@/features/delivery/api.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const CATEGORIES = ['open', 'in_progress', 'in_review', 'done', 'cancelled']
const KINDS = { start: 'First stage', normal: 'Stage', end: 'Last stage' }
// A workflow with no version yet starts from this.
const SKELETON = {
  stages: [
    { code: 'to_do', name: 'To do', seq: 1, stage_type: 'start', status_category: 'open' },
    { code: 'doing', name: 'Doing', seq: 2, stage_type: 'normal', status_category: 'in_progress' },
    { code: 'done', name: 'Done', seq: 3, stage_type: 'end', status_category: 'done' },
  ],
  transitions: [
    { code: 'start', name: 'Start', from: 'to_do', to: 'doing', trigger_type: 'manual' },
    { code: 'finish', name: 'Finish', from: 'doing', to: 'done', trigger_type: 'manual' },
  ],
}

// A task workflow's stages and steps, changed and published as its next version. Tasks already
// following it keep the version they started on; new tasks follow the new one. What this page
// doesn't show (a step's conditions, a stage's tasks) is kept as it was.
export default function WorkflowBuilder() {
  const { code } = useParams()
  const { orgId } = useActiveOrg()
  const enabled = Boolean(orgId)
  const definitions = useQuery(
    ['workflow-definitions', orgId, 'task.task'],
    ({ signal }) => workflowsApi.definitions(orgId, { subject_type: 'task.task' }, { signal }),
    { enabled }
  )
  const definition = (definitions.data ?? []).find((d) => d.code === code)
  const versionNo = definition?.current_version_no
  const current = useQuery(
    ['workflow-version', orgId, code, versionNo],
    ({ signal }) => workflowsApi.version(orgId, code, versionNo, { signal }),
    { enabled: enabled && Boolean(versionNo) }
  )

  if (definitions.loading || (versionNo && current.loading)) return <PanelSkeleton />
  if (!definition) {
    return <ErrorBanner error={definitions.error || current.error || { message: 'This task workflow doesn’t exist in this company.' }} />
  }
  return (
    <Editor
      key={`${code}-${versionNo || 0}`}
      orgId={orgId}
      definition={definition}
      initial={current.data?.content ?? SKELETON}
    />
  )
}

function slug(text, taken) {
  const base = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
  let candidate = base
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}_${n}`
  return candidate
}

// What publishing would refuse, said before trying.
function problems(stages, transitions) {
  const found = []
  const starts = stages.filter((s) => s.stage_type === 'start')
  if (starts.length !== 1) found.push('Mark exactly one stage as the first stage.')
  if (!stages.some((s) => s.stage_type === 'end')) found.push('Mark at least one stage as a last stage.')
  for (const s of stages) {
    if (!s.name.trim()) found.push('Every stage needs a name.')
    if (s.stage_type === 'end' && !['done', 'cancelled'].includes(s.status_category)) {
      found.push(`“${s.name || 'A last stage'}” must stand for Done or Cancelled.`)
    }
  }
  for (const t of transitions) {
    if (!t.name.trim()) found.push('Every step needs a name.')
    if (t.from === t.to) found.push(`“${t.name || 'A step'}” must go to another stage.`)
  }
  // Every stage must be reachable from the first one.
  if (starts.length === 1) {
    const reached = new Set([starts[0].code])
    let grew = true
    while (grew) {
      grew = false
      for (const t of transitions) {
        if (reached.has(t.from) && !reached.has(t.to)) {
          reached.add(t.to)
          grew = true
        }
      }
    }
    for (const s of stages) if (!reached.has(s.code)) found.push(`No step leads to “${s.name}”.`)
  }
  return [...new Set(found)]
}

function Editor({ orgId, definition, initial }) {
  const names = useDeliveryNames(orgId)
  const [stages, setStages] = useState(() => initial.stages.map((s) => ({ ...s, status_category: s.status_category || 'open' })))
  const [transitions, setTransitions] = useState(() => initial.transitions.map((t) => ({ ...t })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const units = (names.units || []).filter((u) => u.status !== 'inactive')
  const found = problems(stages, transitions)
  const stageName = (stageCode) => stages.find((s) => s.code === stageCode)?.name || '—'

  const setStage = (index, changes) => setStages((all) => all.map((s, i) => (i === index ? { ...s, ...changes } : s)))
  const setStep = (index, changes) => setTransitions((all) => all.map((t, i) => (i === index ? { ...t, ...changes } : t)))

  function addStage() {
    const taken = new Set(stages.map((s) => s.code))
    setStages((all) => [...all, { code: slug('stage', taken), name: '', seq: all.length + 1, stage_type: 'normal', status_category: 'in_progress' }])
  }

  function removeStage(index) {
    const removed = stages[index].code
    setStages((all) => all.filter((_, i) => i !== index))
    setTransitions((all) => all.filter((t) => t.from !== removed && t.to !== removed))
  }

  function addStep() {
    const taken = new Set(transitions.map((t) => t.code))
    setTransitions((all) => [...all, { code: slug('step', taken), name: '', from: stages[0]?.code, to: stages[1]?.code ?? stages[0]?.code, trigger_type: 'manual' }])
  }

  async function publish() {
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      const content = {
        stages: stages.map((s, i) => ({ ...s, seq: i + 1, name: s.name.trim() })),
        transitions: transitions.map((t) => ({ ...t, name: t.name.trim() })),
        ...(initial.automation_rules ? { automation_rules: initial.automation_rules } : {}),
      }
      const draft = await workflowsApi.createVersion(orgId, definition.code, content)
      await workflowsApi.publishVersion(orgId, definition.code, draft.version_no)
      invalidate(['workflow-definitions', orgId])
      invalidate(['workflow-version', orgId, definition.code])
      setNotice(`Version ${draft.version_no} published. Tasks already following the workflow keep their version; new tasks follow this one.`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{definition.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Task workflow <span className="mono">{definition.code}</span>
            {definition.current_version_no ? ` · version ${definition.current_version_no} is in use` : ' · not published yet'}
          </p>
        </div>
        <Link className="btn secondary" to="/task-types">Back to task types</Link>
      </div>
      {notice && <div className="alert success">{notice}</div>}
      <ErrorBanner error={error} />

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Stages</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Each stage sets the task’s status while it is there. A stage with a team moves the task to that team’s queue
          when it gets there.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Kind</th>
                <th>Task status</th>
                <th>Team</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={s.code}>
                  <td><input aria-label="Stage name" value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} /></td>
                  <td>
                    <select aria-label="Kind" value={s.stage_type} onChange={(e) => setStage(i, { stage_type: e.target.value })}>
                      {Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      {!KINDS[s.stage_type] && <option value={s.stage_type}>{s.stage_type}</option>}
                    </select>
                  </td>
                  <td>
                    <select aria-label="Task status" value={s.status_category} onChange={(e) => setStage(i, { status_category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{TASK_STATUS_LABELS[c] || c}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label="Team"
                      value={s.owner_unit_selector?.unit_id || ''}
                      onChange={(e) => setStage(i, { owner_unit_selector: e.target.value ? { unit_id: e.target.value } : {} })}
                    >
                      <option value="">— The task’s own team —</option>
                      {s.owner_unit_selector?.unit_id && !units.some((u) => u.id === s.owner_unit_selector.unit_id) && (
                        <option value={s.owner_unit_selector.unit_id}>{names.unitName(s.owner_unit_selector.unit_id)}</option>
                      )}
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn secondary small-btn" onClick={() => removeStage(i)} disabled={stages.length <= 2}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addStage}>+ Add a stage</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Steps</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          The buttons on a task: each moves it from one stage to another. A step that needs approval waits for someone
          allowed to approve workflow steps.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>From</th>
                <th>To</th>
                <th>Needs approval</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transitions.map((t, i) => (
                <tr key={t.code}>
                  <td><input aria-label="Step name" value={t.name} onChange={(e) => setStep(i, { name: e.target.value })} /></td>
                  <td>
                    <select aria-label="From" value={t.from} onChange={(e) => setStep(i, { from: e.target.value })}>
                      {stages.map((s) => <option key={s.code} value={s.code}>{s.name || s.code}</option>)}
                    </select>
                  </td>
                  <td>
                    <select aria-label="To" value={t.to} onChange={(e) => setStep(i, { to: e.target.value })}>
                      {stages.map((s) => <option key={s.code} value={s.code}>{s.name || s.code}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Needs approval"
                      checked={Boolean(t.approval_policy_code)}
                      onChange={(e) => setStep(i, { approval_policy_code: e.target.checked ? 'default' : null })}
                    />
                  </td>
                  <td><button type="button" className="btn secondary small-btn" onClick={() => setTransitions((all) => all.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn secondary" style={{ marginTop: 10 }} onClick={addStep} disabled={stages.length < 2}>+ Add a step</button>
        {transitions.length === 0 && <p className="muted small">No steps yet: a task could never leave its first stage.</p>}
      </div>

      {found.length > 0 && (
        <div className="alert warn">
          {found.map((p) => <div key={p}>{p}</div>)}
        </div>
      )}
      <div className="row-actions">
        <button className="btn" disabled={busy || found.length > 0} aria-busy={busy} onClick={publish}>Publish as the next version</button>
        <span className="muted small">
          Steps: {transitions.map((t) => `${t.name || '…'} (${stageName(t.from)} → ${stageName(t.to)})`).join(', ') || 'none'}
        </span>
      </div>
    </div>
  )
}
