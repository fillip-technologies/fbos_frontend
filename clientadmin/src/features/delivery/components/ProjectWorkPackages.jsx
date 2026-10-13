import { projectsApi } from '@/features/delivery/api.js'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const STATUS_LABELS = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' }

// The project's work packages: chunks of work its template planned, each for a phase and a
// team, with the hours expected. Read only: they come with the template. Nothing shows when
// the project has none.
export default function ProjectWorkPackages({ orgId, project, names }) {
  const enabled = Boolean(orgId)
  const packages = useQuery(
    ['project', orgId, project.id, 'work-packages'],
    ({ signal }) => projectsApi.workPackages(orgId, project.id, { signal }),
    { enabled }
  )
  // Shared with the overview: the phases' names.
  const { data: summary } = useQuery(
    ['project', orgId, project.id, 'summary'],
    ({ signal }) => projectsApi.summary(orgId, project.id, { signal }),
    { enabled }
  )
  if (packages.error) return <ErrorBanner error={packages.error} onRetry={packages.reload} />
  const rows = packages.data ?? []
  if (rows.length === 0) return null

  const phaseName = (id) => (summary?.phases ?? []).find((p) => p.id === id)?.name
  const hours = rows.reduce((sum, p) => sum + p.estimated_hours, 0)

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Work packages</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Planned by the project’s template: {rows.length} package{rows.length === 1 ? '' : 's'}, {formatHours(hours)} in all.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Phase</th>
              <th>Team</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} style={{ cursor: 'default' }}>
                <td>{p.name}</td>
                <td>{phaseName(p.phase_id) || <span className="muted">—</span>}</td>
                <td>{p.owner_unit ? names.unitName(p.owner_unit) : <span className="muted">The project’s team</span>}</td>
                <td>{p.estimated_hours ? formatHours(p.estimated_hours) : <span className="muted">—</span>}</td>
                <td><StatusBadge status={p.status} label={STATUS_LABELS[p.status] || p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const formatHours = (h) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} h`
