import { useState } from 'react'
import { workflowsApi } from '@/features/delivery/api.js'
import { SUBJECT_TYPES, formatDateTime } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const INSTANCE_STATUS_LABELS = {
  created: 'Created',
  running: 'Running',
  waiting_approval: 'Waiting for approval',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
}
const FINISHED = ['completed', 'cancelled', 'failed']

// The workflows a record runs through (a project's lifecycle, a task's approval path): the
// stages it has passed, where it is now, and the steps it can take next. People who operate
// workflows start one here and move it on; the backend checks each step's own conditions.
export default function WorkflowPanel({ orgId, subject }) {
  const { user: me } = useAuth()
  const canRead = hasAccess(me, ACCESS.workflows)
  const canOperate = hasAccess(me, ACCESS.operateWorkflows)
  const enabled = Boolean(orgId && canRead)
  const runsKey = ['workflow-instances', orgId, subject.type, subject.id]
  const runs = useQuery(runsKey, ({ signal }) => workflowsApi.instances(orgId, { subject_type: subject.type, subject_id: subject.id }, { signal }), { enabled })
  const definitions = useQuery(
    ['workflow-definitions', orgId, subject.type],
    ({ signal }) => workflowsApi.definitions(orgId, { subject_type: subject.type }, { signal }),
    { enabled: enabled && canOperate }
  )
  if (!canRead) return null

  function changed() {
    invalidate(runsKey)
    // A workflow a task follows moves the task itself (its status, its team): read it again.
    if (subject.type === SUBJECT_TYPES.task) {
      invalidate(['task', orgId, subject.id])
      invalidate(['tasks', orgId])
    }
  }

  const instances = runs.data ?? []
  const startable = (definitions.data ?? []).filter(
    (d) => d.status === 'active' && d.current_version_no && !instances.some((i) => i.definition.code === d.code && !FINISHED.includes(i.status))
  )
  if (!instances.length && !startable.length) return null

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Workflow</h2>
      <ErrorBanner error={runs.error} onRetry={runs.reload} />
      {instances.map((run) => (
        <WorkflowRun key={run.id} orgId={orgId} run={run} canOperate={canOperate} onChanged={changed} />
      ))}
      {canOperate && startable.length > 0 && <StartWorkflow orgId={orgId} subject={subject} definitions={startable} onStarted={changed} />}
    </div>
  )
}

function WorkflowRun({ orgId, run, canOperate, onChanged }) {
  const live = !FINISHED.includes(run.status)
  const history = useQuery(['workflow-instance', orgId, run.id, 'history', run.version], ({ signal }) => workflowsApi.history(orgId, run.id, { signal }), {
    enabled: Boolean(orgId),
  })
  const transitions = useQuery(
    ['workflow-instance', orgId, run.id, 'transitions', run.version],
    ({ signal }) => workflowsApi.availableTransitions(orgId, run.id, { signal }),
    { enabled: Boolean(orgId) && live && run.status === 'running' }
  )
  const [pending, setPending] = useState(null) // { kind: 'transition' | 'hold' | 'cancel', transition? }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  // `call` answers with what to tell the user, if anything.
  async function act(call) {
    setError(null)
    setBusy(true)
    try {
      const message = await call()
      setPending(null)
      setReason('')
      setNotice(message || '')
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const current = run.current_stages.map((s) => s.stage_name).join(' + ')
  const passed = (history.data ?? []).map((h) => h.stage_code)

  function confirm(e) {
    e.preventDefault()
    const text = reason.trim()
    if (pending.kind === 'hold') return act(() => workflowsApi.hold(orgId, run, text).then(() => 'Put on hold.'))
    if (pending.kind === 'cancel') return act(() => workflowsApi.cancel(orgId, run, text).then(() => 'Workflow cancelled.'))
    return act(async () => {
      const result = await workflowsApi.transition(orgId, run, { transition_code: pending.transition.code, ...(text ? { reason: text } : {}) })
      return result.outcome === 'approval_pending' ? 'Sent for approval: it moves on once approved.' : ''
    })
  }

  return (
    <div className="workflow-run">
      <div className="row-actions" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{run.definition.name || run.definition.code}</strong>
        <span className="muted small">v{run.version_no}</span>
        <StatusBadge status={run.status === 'running' ? 'in_progress' : run.status} label={INSTANCE_STATUS_LABELS[run.status]} />
        <span className="muted small">since {formatDateTime(run.started_at)}</span>
      </div>

      <ol className="stage-path" aria-label="Stages">
        <li className="passed">Started</li>
        {passed.map((code, i) => <li key={`${code}-${i}`} className="passed">{code.replace(/_/g, ' ')}</li>)}
        {current && live && <li className="current" aria-current="step">{current}</li>}
        {live && (transitions.data ?? []).filter((t) => t.allowed).map((t) => <li key={t.code} className="next">{t.to_stage.replace(/_/g, ' ')}</li>)}
      </ol>

      {notice && <div className="alert success" role="status">{notice}</div>}
      <ErrorBanner error={error || history.error || transitions.error} />

      {live && canOperate && !pending && (
        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
          {(transitions.data ?? []).map((t) => (
            <button
              key={t.code}
              className="btn small-btn"
              disabled={!t.allowed || busy}
              title={t.allowed ? `Move to ${t.to_stage}` : t.blocked_reasons.join('; ')}
              onClick={() => setPending({ kind: 'transition', transition: t })}
            >
              {t.name}{t.requires_approval ? ' (needs approval)' : ''}
            </button>
          ))}
          {run.status === 'on_hold' ? (
            <button className="btn secondary small-btn" disabled={busy} onClick={() => act(() => workflowsApi.resume(orgId, run).then(() => 'Resumed.'))}>Resume</button>
          ) : (
            <button className="btn secondary small-btn" onClick={() => setPending({ kind: 'hold' })}>Hold</button>
          )}
          <button className="btn secondary small-btn" onClick={() => setPending({ kind: 'cancel' })}>Cancel workflow</button>
        </div>
      )}
      {live && (transitions.data ?? []).some((t) => !t.allowed) && (
        <p className="muted small">Greyed steps can't be taken yet: hover them to see why.</p>
      )}

      {pending && (
        <form onSubmit={confirm} className="row-actions" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
            <label htmlFor={`wf_reason_${run.id}`}>
              {pending.kind === 'transition' ? `${pending.transition.name}: note` : pending.kind === 'hold' ? 'Why hold it? *' : 'Why cancel it? *'}
            </label>
            <input id={`wf_reason_${run.id}`} autoFocus required={pending.kind !== 'transition'} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={busy} aria-busy={busy}>Confirm</button>
          <button className="btn secondary" type="button" onClick={() => setPending(null)}>Back</button>
        </form>
      )}
    </div>
  )
}

function StartWorkflow({ orgId, subject, definitions, onStarted }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function start() {
    setError(null)
    setBusy(true)
    try {
      await workflowsApi.start(orgId, { definition_code: code, subject })
      setCode('')
      onStarted()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <ErrorBanner error={error} />
      <div className="row-actions" style={{ marginTop: 10 }}>
        <select aria-label="Workflow to start" value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">— Start a workflow —</option>
          {definitions.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        <button className="btn secondary" disabled={!code || busy} aria-busy={busy} onClick={start}>Start</button>
      </div>
    </>
  )
}
