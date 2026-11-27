import { useState } from 'react'
import { Link } from 'react-router-dom'
import { routingApi, setupApi, workflowsApi } from '@/features/delivery/api.js'
import { guessUnit, runSetup, setupProblems, typeCodeOf } from '@/features/delivery/departmentSetup.js'
import { invalidate } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Sets up one department operation from start to finish with the calls the existing screens make:
// the workflow (saved and published, each stage's team written into it), the task type that follows
// it, the link between them, the routing rule to the department's team, and a check that reads it
// all back. The steps live in features/delivery/departmentSetup.js (tested against a stand-in API).
// Every step looks first and never overwrites; "Try again" after a failure carries on from there.

// The real calls, for one company.
const apiFor = (orgId) => ({
  definitions: () => workflowsApi.definitions(orgId, { subject_type: 'task.task' }),
  createDefinition: (body) => workflowsApi.createDefinition(orgId, body),
  versions: (code) => workflowsApi.versions(orgId, code),
  createVersion: (code, content) => workflowsApi.createVersion(orgId, code, content),
  publishVersion: (code, no) => workflowsApi.publishVersion(orgId, code, no),
  taskTypes: () => setupApi.taskTypes(orgId),
  createTaskType: (body) => setupApi.createTaskType(orgId, body),
  setTypeWorkflow: (id, code) => setupApi.setTypeWorkflow(orgId, id, code),
  rules: () => routingApi.rules(orgId),
  createRule: (body) => routingApi.createRule(orgId, body),
  route: (code) => routingApi.route(orgId, code, null),
})

export default function DepartmentSetup({ orgId, template, units, types, onClose, onDone }) {
  const hintedStages = Object.keys(template.teams || {})
  const defaultTypeCode = typeCodeOf(template)
  const existingDefault = types.find((t) => t.code === defaultTypeCode && !t.archived)

  const [home, setHome] = useState(() => guessUnit(units, template.home))
  const [stageTeams, setStageTeams] = useState(() =>
    Object.fromEntries(hintedStages.map((code) => [code, guessUnit(units, template.teams[code])]))
  )
  const [typeCode, setTypeCode] = useState(existingDefault ? existingDefault.code : 'new')
  const [typeName, setTypeName] = useState(template.name)
  const [route, setRoute] = useState(true)
  const [progress, setProgress] = useState([]) // [{ key, state: 'running' | 'done' | 'kept' | 'failed', text }]
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)

  const stageName = (code) => template.stages.find((s) => s.code === code)?.name || code
  const unitName = (id) => units.find((u) => u.id === id)?.name || 'a team'
  const existingType = typeCode === 'new' ? null : types.find((t) => t.code === typeCode)
  const problems = setupProblems({ template, home, stageTeams, typeCode, typeName, existingType })

  const note = (key, state, text) =>
    setProgress((rows) => (rows.some((r) => r.key === key) ? rows.map((r) => (r.key === key ? { key, state, text } : r)) : [...rows, { key, state, text }]))

  async function run() {
    if (problems.length || running) return
    setRunning(true)
    setError(null)
    setFinished(false)
    try {
      const result = await runSetup({ api: apiFor(orgId), template, home, stageTeams, typeCode, typeName, route, unitName, note })
      setFinished(result.ok)
    } catch (err) {
      if (!err?.handled) setError(err)
      setProgress((rows) => rows.map((r) => (r.state === 'running' ? { ...r, state: 'failed' } : r)))
    } finally {
      invalidate(['workflow-definitions', orgId])
      invalidate(['task-types', orgId])
      invalidate(['routing-rules', orgId])
      invalidate(['task-routing', orgId])
      invalidate(['department-setup', orgId])
      setRunning(false)
      onDone?.()
    }
  }

  const finalType = typeCode === 'new' ? defaultTypeCode : typeCode
  const mark = { running: '…', done: '✓', kept: '•', failed: '✗' }
  return (
    <div className="panel" style={{ border: '1px solid var(--border, #e2e8f0)', marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Set up “{template.name}”</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        This makes the workflow the company’s own and published now, ties a task type to it and says which team gets the work.
        Anything already there is left as it is.
      </p>

      <div className="field">
        <label htmlFor={`home-${template.code}`}>The team that does this work</label>
        <select id={`home-${template.code}`} value={home} disabled={running} onChange={(e) => setHome(e.target.value)}>
          <option value="">Choose the team…</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {units.length === 0 && <div className="hint">No teams yet. Add them under Company structure first.</div>}
      </div>

      {hintedStages.map((code) => (
        <div className="field" key={code}>
          <label htmlFor={`stage-${template.code}-${code}`}>Team for the stage “{stageName(code)}”</label>
          <select id={`stage-${template.code}-${code}`} value={stageTeams[code]} disabled={running} onChange={(e) => setStageTeams((s) => ({ ...s, [code]: e.target.value }))}>
            <option value="">Choose the team…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      ))}

      <div className="field">
        <label htmlFor={`type-${template.code}`}>Task type that follows it</label>
        <select id={`type-${template.code}`} value={typeCode} disabled={running} onChange={(e) => setTypeCode(e.target.value)}>
          <option value="new">Make a new type</option>
          {types.filter((t) => !t.archived).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      </div>
      {typeCode === 'new' && (
        <div className="field">
          <label htmlFor={`typename-${template.code}`}>New task type’s name</label>
          <input id={`typename-${template.code}`} value={typeName} disabled={running} onChange={(e) => setTypeName(e.target.value)} />
        </div>
      )}
      <label className="inline-check">
        <input type="checkbox" checked={route} disabled={running} onChange={(e) => setRoute(e.target.checked)} />
        Send this kind of work to that team (adds a routing rule)
      </label>

      {problems.length > 0 && (
        <ul className="small" style={{ color: 'var(--critical, #b42318)', paddingLeft: 18 }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {progress.length > 0 && (
        <ul className="small" style={{ listStyle: 'none', padding: 0 }} aria-live="polite">
          {progress.map((r) => (
            <li key={r.key} style={{ padding: '2px 0', color: r.state === 'failed' ? 'var(--critical, #b42318)' : undefined }}>
              <strong aria-hidden="true">{mark[r.state]}</strong> {r.text}
            </li>
          ))}
        </ul>
      )}
      <ErrorBanner error={error} />

      <div className="row-actions">
        <button type="button" className="btn" disabled={running || problems.length > 0} aria-busy={running} onClick={run}>
          {progress.some((r) => r.state === 'failed') ? 'Try again' : 'Set it up'}
        </button>
        <button type="button" className="btn secondary" disabled={running} onClick={onClose}>{finished ? 'Close' : 'Cancel'}</button>
      </div>

      {finished && (
        <div className="small" style={{ marginTop: 10 }}>
          <strong>Next:</strong>{' '}
          <Link to={`/task-workflows/${template.code}`}>Look at the stages</Link>
          {' · '}<Link to="/playbooks">Add checklists</Link>
          {' · '}<Link to="/task-types">Set a time limit</Link>
          {' · '}<Link to={`/tasks/new?type=${finalType}`}>Start a task of this type</Link>
          <div className="muted">A reviewer is named on the task itself. Who checks each stage is not supported yet.</div>
        </div>
      )}
    </div>
  )
}
