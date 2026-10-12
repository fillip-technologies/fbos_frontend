import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { workflowsApi } from '@/features/delivery/api.js'
import { SUBJECT_TYPES } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The company's project workflows: the stages a project goes through (e.g. Planning, Build,
// Handover) and the steps between them. A template can start one with each new project; anyone
// running workflows can also start one from a project's page.
export default function ProjectWorkflows({ orgId, templates }) {
  const { user: me } = useAuth()
  const canRead = hasAccess(me, ACCESS.workflows)
  const canDesign = hasAccess(me, ACCESS.designWorkflows)
  const navigate = useNavigate()
  const definitions = useQuery(
    ['workflow-definitions', orgId, SUBJECT_TYPES.project],
    ({ signal }) => workflowsApi.definitions(orgId, { subject_type: SUBJECT_TYPES.project }, { signal }),
    { enabled: Boolean(orgId) && canRead }
  )
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!canRead) return null
  const workflows = definitions.data ?? []

  // A new one gets a code from its name. Task and project workflows share codes, so it is
  // made unique among all of them.
  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const taken = new Set((await workflowsApi.definitions(orgId)).map((d) => d.code))
      const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'project-workflow'
      let code = base
      for (let n = 2; taken.has(code); n += 1) code = `${base}-${n}`
      await workflowsApi.createDefinition(orgId, { code, name: name.trim(), subject_type: SUBJECT_TYPES.project })
      invalidate(['workflow-definitions', orgId])
      navigate(`/project-workflows/${code}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Project workflows</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        The stages a project goes through and the steps between them. Choose one on a template to start it with each new
        project, or start one from a project’s page.
      </p>
      <ErrorBanner error={definitions.error || error} onRetry={definitions.error ? definitions.reload : undefined} />

      {workflows.length === 0 && !definitions.loading && <p className="muted small">None yet.</p>}
      {workflows.map((w) => {
        const users = templates.filter((t) => t.published_workflow_definition_code === w.code)
        return (
          <div key={w.code} className="small" style={{ padding: '2px 0' }}>
            <strong>{w.name}</strong> <span className="mono muted">{w.code}</span>
            <span className="muted">
              {' · '}
              {!w.current_version_no
                ? 'not published yet'
                : users.length ? `started by ${users.map((t) => t.name).join(', ')}` : `version ${w.current_version_no}, no template starts it`}
            </span>
            {canDesign && <> · <Link to={`/project-workflows/${w.code}`}>{w.current_version_no ? 'Change it' : 'Finish it'}</Link></>}
          </div>
        )
      })}

      {canDesign && (
        <form className="toolbar" style={{ marginTop: 10 }} onSubmit={create}>
          <input aria-label="New project workflow's name" placeholder="New workflow’s name, e.g. Website delivery" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn secondary" type="submit" disabled={busy} aria-busy={busy}>Start a workflow</button>
        </form>
      )}
    </div>
  )
}
