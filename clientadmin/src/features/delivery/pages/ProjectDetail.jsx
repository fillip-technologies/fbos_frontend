import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { projectsApi } from '@/features/delivery/api.js'
import ProjectChangeRequests from '@/features/delivery/components/ProjectChangeRequests.jsx'
import ProjectMilestones from '@/features/delivery/components/ProjectMilestones.jsx'
import ProjectOverview from '@/features/delivery/components/ProjectOverview.jsx'
import ProjectRisks from '@/features/delivery/components/ProjectRisks.jsx'
import ProjectTasks from '@/features/delivery/components/ProjectTasks.jsx'
import ProjectTeam from '@/features/delivery/components/ProjectTeam.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { HEALTH_LABELS, PROJECT_STATUS_LABELS } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const TABS = [
  ['overview', 'Overview'],
  ['tasks', 'Tasks'],
  ['milestones', 'Milestones'],
  ['team', 'Team'],
  ['risks', 'Risks'],
  ['changes', 'Change requests'],
]

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)

  const { data: project, error, loading, reload, setData } = useQuery(
    ['project', orgId, id],
    ({ signal }) => projectsApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )
  // A changed project: shown at once, and lists and its summary refetch.
  const setProject = (saved) => {
    setData(saved)
    invalidate(['projects', orgId])
    invalidate(['project', orgId, id, 'summary'])
  }

  if (loading) return <DetailSkeleton />
  if (!project)
    return (
      <div>
        <ErrorBanner error={error} onRetry={reload} />
        <button className="btn secondary" onClick={() => navigate('/projects')}>← Back</button>
      </div>
    )

  const tabProps = { orgId, project, setProject, names }
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {project.name} <StatusBadge status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />{' '}
            <StatusBadge status={project.health} label={HEALTH_LABELS[project.health]} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            <span className="mono">{project.code}</span> · {project.type.name}
            {activeOrg && ` · ${activeOrg.name}`}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/projects')}>← Back</button>
      </div>

      <div className="version-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <ProjectOverview {...tabProps} />}
      {tab === 'tasks' && <ProjectTasks {...tabProps} />}
      {tab === 'milestones' && <ProjectMilestones {...tabProps} />}
      {tab === 'team' && <ProjectTeam {...tabProps} />}
      {tab === 'risks' && <ProjectRisks {...tabProps} />}
      {tab === 'changes' && <ProjectChangeRequests {...tabProps} />}
    </div>
  )
}
