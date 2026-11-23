import { Link, useNavigate } from 'react-router-dom'
import { projectsApi } from '@/features/delivery/api.js'
import { HEALTH_LABELS, PROJECT_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

// A project's workstreams: one per department or team, each run by its own team and manager.
// The project's progress is theirs combined, each weighed by its tasks.
export default function ProjectWorkstreams({ orgId, project, names }) {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { data, error, loading, reload } = useQuery(
    ['projects', orgId, { parent: project.id }],
    ({ signal }) => projectsApi.list(orgId, { parent_id: project.id, limit: 100 }, { signal }),
  )
  const streams = data?.data ?? []
  const canAdd = hasAccess(me, ACCESS.manageProjects) && !['completed', 'closed', 'cancelled'].includes(project.status)

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: 17 }}>Workstreams</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Overall progress {Math.round(project.progress_pct)}%: every workstream’s done tasks out of its tasks.
          </p>
        </div>
        {canAdd && (
          <Link className="btn small-btn" to={`/projects/new?parent=${project.id}${project.client ? `&customer=${project.client.id}` : ''}`}>
            + Add workstream
          </Link>
        )}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <PanelSkeleton />
      ) : streams.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          No workstreams: one team delivers this project. Add one per department or team when several take part.
        </p>
      ) : (
        <table>
          <thead>
            <tr><th>Workstream</th><th>Team</th><th>Manager</th><th>Status</th><th style={{ width: 180 }}>Progress</th></tr>
          </thead>
          <tbody>
            {streams.map((w) => (
              <tr key={w.id} onClick={() => navigate(`/projects/${w.id}`)}>
                <td>
                  <Link to={`/projects/${w.id}`} onClick={(e) => e.stopPropagation()}>{w.name}</Link>
                  <div className="muted small mono">{w.code}</div>
                </td>
                <td>{names.unitName(w.owning_unit)}</td>
                <td>{names.personName(w.manager)}</td>
                <td>
                  <StatusBadge status={w.status} label={PROJECT_STATUS_LABELS[w.status]} />{' '}
                  <StatusBadge status={w.health} label={HEALTH_LABELS[w.health]} />
                </td>
                <td>
                  <div className="progress" style={{ marginTop: 0 }} aria-label={`${Math.round(w.progress_pct)}% done`}>
                    <span style={{ width: `${Math.min(100, w.progress_pct)}%` }} />
                  </div>
                  <span className="muted small">{Math.round(w.progress_pct)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
