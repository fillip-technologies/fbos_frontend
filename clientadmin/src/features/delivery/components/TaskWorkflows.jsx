import { useState } from 'react'
import { workflowsApi } from '@/features/delivery/api.js'
import { disciplineLabel } from '@/features/delivery/taskFields.js'
import { TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The company's task workflows, and ready-made ones to install. An installed one becomes the
// company's own (published as version 1); a task type then follows it from the type's
// "Follows workflow" picker below, and its new tasks move by the workflow's steps.
export default function TaskWorkflows({ orgId, types, installed, canDesign }) {
  const { data: templates, error: loadError, reload } = useQuery(
    ['workflow-templates', orgId],
    ({ signal }) => workflowsApi.templates(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )
  const [busy, setBusy] = useState(null) // a template code
  const [error, setError] = useState(null)
  const installedCodes = new Set(installed.map((w) => w.code))

  async function install(code) {
    setBusy(code)
    setError(null)
    try {
      await workflowsApi.installTemplate(orgId, code)
      invalidate(['workflow-definitions', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Task workflows</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        A task type can follow a workflow: its new tasks then move by the workflow’s steps (each stage sets the task’s
        status) instead of start, submit and review. Install a ready-made one, then choose it on a type below. Tasks
        already made keep moving as they did.
      </p>
      <ErrorBanner error={loadError || error} onRetry={reload} />

      {installed.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="detail-label">Installed</div>
          {installed.map((w) => {
            const followers = types.filter((t) => t.workflow?.code === w.code)
            return (
              <div key={w.code} className="small" style={{ padding: '2px 0' }}>
                <strong>{w.name}</strong> <span className="mono muted">{w.code}</span>
                <span className="muted"> · {followers.length ? `followed by ${followers.map((t) => t.name).join(', ')}` : 'no type follows it yet'}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="type-cards">
        {(templates ?? []).map((t) => (
          <article key={t.code} className="type-card" style={{ cursor: 'default' }}>
            <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{t.name}</strong>
              <span className="muted small">{disciplineLabel(t.discipline)}</span>
            </div>
            <div className="small">{t.summary}</div>
            <div className="chips">
              {t.stages.map((s) => (
                <span key={s.code} className="chip subtle" title={TASK_STATUS_LABELS[s.status_category] || s.status_category}>{s.name}</span>
              ))}
            </div>
            {canDesign && (
              installedCodes.has(t.code) ? (
                <span className="muted small">Installed</span>
              ) : (
                <button
                  type="button"
                  className="btn secondary small-btn"
                  disabled={busy === t.code}
                  aria-busy={busy === t.code}
                  onClick={() => install(t.code)}
                >
                  Install
                </button>
              )
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
