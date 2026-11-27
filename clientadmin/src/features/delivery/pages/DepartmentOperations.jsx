import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { setupApi, routingApi, workflowsApi } from '@/features/delivery/api.js'
import DepartmentSetup from '@/features/delivery/components/DepartmentSetup.jsx'
import { DEPARTMENT_WORKFLOWS } from '@/features/delivery/departmentWorkflows.js'
import { READINESS_LABELS, readiness } from '@/features/delivery/departmentSetup.js'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

// One place to set up how a department works: pick the department, pick an operation (SEO audit,
// Social media post, Bug…), see what is configured and what is missing, and set it up. The form is the
// existing DepartmentSetup; checklists, task types, who-gets-the-work and the stage editor stay on their
// own screens and are linked from the row that needs them.
const SYMBOL = { configured: '✓', missing: '✗', not_applicable: '–', unsupported: '!' }
const STATE_LABEL = { configured: 'Configured', missing: 'Missing', not_applicable: 'Not applicable', unsupported: 'Not supported yet' }
const STATE_COLOR = {
  configured: 'var(--good, #067647)',
  missing: 'var(--critical, #b42318)',
  not_applicable: 'var(--muted, #64748b)',
  unsupported: 'var(--warning, #b54708)',
}
const STATUS_COLOR = { not_ready: STATE_COLOR.missing, ready_with_limits: STATE_COLOR.unsupported, ready: STATE_COLOR.configured }

const DEPARTMENTS = [...new Set(DEPARTMENT_WORKFLOWS.map((t) => t.home))]

export default function DepartmentOperations() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canSetUp = hasAccess(me, ACCESS.designWorkflows)
  const [params, setParams] = useSearchParams()
  const department = DEPARTMENTS.includes(params.get('dept')) ? params.get('dept') : DEPARTMENTS[0]
  const operations = DEPARTMENT_WORKFLOWS.filter((t) => t.home === department)
  const selected = operations.find((t) => t.code === params.get('op')) ?? null
  const [opening, setOpening] = useState(false) // the setup form is open

  const names = useDeliveryNames(orgId)
  const units = (names.units || []).filter((u) => u.status !== 'inactive')
  const { types, error: typesError, loading: typesLoading } = useTaskTypes(orgId)
  const enabled = Boolean(orgId)

  const definitions = useQuery(['workflow-definitions', orgId, 'task.task'], ({ signal }) => workflowsApi.definitions(orgId, { subject_type: 'task.task' }, { signal }), { enabled })
  const rules = useLookup(['routing-rules', orgId], ({ signal }) => routingApi.rules(orgId, { signal }), { enabled })
  const templates = useLookup(['task-templates', orgId], ({ signal }) => setupApi.taskTemplates(orgId, { signal }), { enabled })
  const policies = useLookup(['assignment-policies', orgId], ({ signal }) => setupApi.assignmentPolicies(orgId, { signal }), { enabled })

  // The published stages of this department's installed workflows, to see which stages have a team.
  const installedWithTeams = operations.filter(
    (t) => Object.keys(t.teams || {}).length > 0 && (definitions.data ?? []).some((d) => d.code === t.code && d.current_version_no)
  )
  const versions = useQuery(
    ['department-setup', orgId, 'versions', department, installedWithTeams.map((t) => t.code).join(',')],
    async ({ signal }) => {
      const out = {}
      for (const t of installedWithTeams) {
        const d = definitions.data.find((x) => x.code === t.code)
        try {
          const v = await workflowsApi.version(orgId, t.code, d.current_version_no, { signal })
          out[t.code] = v.content ?? null
        } catch {
          out[t.code] = null
        }
      }
      return out
    },
    { enabled: enabled && Boolean(definitions.data) }
  )

  const ready = Boolean(definitions.data && rules.data && templates.data && !typesLoading)
  const context = (t) => ({
    units,
    types,
    definitions: definitions.data ?? [],
    version: versions.data?.[t.code] ?? null,
    rules: rules.data ?? [],
    policies: policies.data?.data ?? policies.data ?? [],
    templates: templates.data ?? [],
  })
  const result = (t) => readiness(t, context(t))

  const choose = (next) => {
    setOpening(false)
    setParams(next, { replace: true })
  }
  const loadError = typesError || definitions.error || rules.error || templates.error

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Department setup</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            How each department’s work runs in {activeOrg ? `“${activeOrg.name}”` : 'this company'}: the operation, its stages, who does it and what is still missing.
          </p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>

      <div className="version-tabs" role="tablist" aria-label="Departments">
        {DEPARTMENTS.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={d === department} className={`version-tab${d === department ? ' active' : ''}`} onClick={() => choose({ dept: d })}>
            {d}
          </button>
        ))}
      </div>

      <ErrorBanner error={loadError} />
      {!ready && !loadError ? (
        <PanelSkeleton />
      ) : (
        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>{department} operations</h2>
          <table className="table">
            <thead>
              <tr><th>Operation</th><th>Stages</th><th>Ready?</th><th /></tr>
            </thead>
            <tbody>
              {operations.map((t) => {
                const r = result(t)
                return (
                  <tr key={t.code} className={selected?.code === t.code ? 'is-selected' : ''}>
                    <td>
                      <strong>{t.name}</strong>
                      <div className="muted small">{t.summary}</div>
                    </td>
                    <td className="small">{t.stages.length}</td>
                    <td className="small">
                      <span style={{ color: STATUS_COLOR[r.status], fontWeight: 600 }}>{READINESS_LABELS[r.status]}</span>
                      <div className="muted">{r.missing ? `${r.missing} missing` : ''}{r.missing && r.unsupported ? ' · ' : ''}{r.unsupported ? `${r.unsupported} not supported yet` : ''}</div>
                    </td>
                    <td><button type="button" className="btn secondary small-btn" onClick={() => { setOpening(false); setParams({ dept: department, op: t.code }, { replace: true }) }}>Open</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && ready && (
        <Operation
          key={selected.code}
          orgId={orgId}
          template={selected}
          result={result(selected)}
          units={units}
          types={types}
          canSetUp={canSetUp}
          opening={opening}
          setOpening={setOpening}
        />
      )}
    </div>
  )
}

function Operation({ orgId, template, result, units, types, canSetUp, opening, setOpening }) {
  const typeCode = template.code.replace(/-/g, '_')
  return (
    <div className="panel">
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{template.name}</h2>
        <span style={{ color: STATUS_COLOR[result.status], fontWeight: 600 }}>{READINESS_LABELS[result.status]}</span>
      </div>
      <div className="chips" style={{ margin: '8px 0' }}>
        {template.stages.map((s) => <span key={s.code} className="chip subtle">{s.name}</span>)}
      </div>

      <table className="table" aria-label={`What is set up for ${template.name}`}>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.key}>
              <td style={{ width: 28, color: STATE_COLOR[row.state], fontWeight: 700 }} aria-hidden="true">{SYMBOL[row.state]}</td>
              <td style={{ width: 190 }}><strong>{row.label}</strong></td>
              <td className="small">
                <span style={{ color: STATE_COLOR[row.state] }}>{STATE_LABEL[row.state]}.</span> {row.text}
              </td>
              <td className="small">{row.fix && <Link to={row.fix.to}>{row.fix.label}</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        “Ready” needs everything that applies to be configured. A workflow that is only published is not ready, and what the system can’t hold yet is shown as not supported, never as done.
      </p>

      {opening ? (
        <DepartmentSetup orgId={orgId} template={template} units={units} types={types} onClose={() => setOpening(false)} />
      ) : (
        <div className="row-actions">
          {canSetUp ? (
            <button type="button" className="btn" onClick={() => setOpening(true)}>
              {result.rows.some((r) => r.key === 'workflow' && r.state === 'configured') ? 'Finish setting up' : 'Set up'}
            </button>
          ) : (
            <span className="muted small">Setting up needs permission to manage workflows.</span>
          )}
          <Link className="btn secondary" to={`/tasks/new?type=${typeCode}`}>Start a task of this type</Link>
          <Link className="btn secondary" to="/playbooks">Checklists</Link>
          <Link className="btn secondary" to="/task-types">Task types and time limits</Link>
        </div>
      )}
    </div>
  )
}
