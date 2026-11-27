import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { projectsApi } from '@/features/delivery/api.js'
import BoardView from '@/features/delivery/components/BoardView.jsx'
import ProjectChangeRequests from '@/features/delivery/components/ProjectChangeRequests.jsx'
import ProjectMilestones from '@/features/delivery/components/ProjectMilestones.jsx'
import ProjectOverview from '@/features/delivery/components/ProjectOverview.jsx'
import ProjectRisks from '@/features/delivery/components/ProjectRisks.jsx'
import ProjectTasks from '@/features/delivery/components/ProjectTasks.jsx'
import ProjectTeam from '@/features/delivery/components/ProjectTeam.jsx'
import ProjectWorkPackages from '@/features/delivery/components/ProjectWorkPackages.jsx'
import ProjectWorkstreams from '@/features/delivery/components/ProjectWorkstreams.jsx'
import WorkflowPanel from '@/features/delivery/components/WorkflowPanel.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { HEALTH_LABELS, PROJECT_STATUS_LABELS, SUBJECT_TYPES } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import DocumentPanel from '@/features/documents/components/DocumentPanel.jsx'
import { DOCUMENT_SUBJECTS } from '@/features/documents/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import JourneyPath from '@/features/journey/components/JourneyPath.jsx'
import { ProjectInsights } from '@/features/insights/panels.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const TABS = [
  ['overview', 'Overview'],
  // A project's departments and teams; a workstream has none of its own.
  ['workstreams', 'Workstreams'],
  ['insights', 'Insights'],
  ['tasks', 'Tasks'],
  ['board', 'Board'],
  ['milestones', 'Milestones'],
  ['team', 'Team'],
  ['risks', 'Risks'],
  ['changes', 'Change requests'],
  ['documents', 'Documents'],
]

const MAIN_TABS = ['overview', 'tasks', 'board', 'documents']

export default function ProjectDetail() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requested = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview'
  const { orgId, activeOrg } = useActiveOrg()
  const { user: me } = useAuth()
  const names = useDeliveryNames(orgId)

  const { data: project, error, loading, reload, setData } = useQuery(
    ['project', orgId, id],
    ({ signal }) => projectsApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )

  const canAttach =
    hasAccess(me, ACCESS.manageProjects) &&
    hasAccess(me, ACCESS.uploadDocuments) &&
    !['completed', 'closed', 'cancelled'].includes(project?.status)

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
  const tabs = TABS.filter(([key]) => key !== 'workstreams' || !project.parent)
  const tab = tabs.some(([key]) => key === requested) ? requested : 'overview'
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
            {project.parent && (
              <>
                {' · part of '}
                <Link to={`/projects/${project.parent.id}?tab=workstreams`}>{project.parent.name}</Link>
              </>
            )}
            {project.workstream_count > 0 && ` · ${project.workstream_count} workstream${project.workstream_count === 1 ? '' : 's'}`}
            {activeOrg && ` · ${activeOrg.name}`}
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate('/projects')}>← Back</button>
      </div>

      {project.contract?.id && <JourneyPath subject="project" id={project.id} contractId={project.contract.id} />}

      {/* The four tabs used every day stay in front; the rest sit behind "More". */}
      {(() => {
        const main = tabs.filter(([key]) => MAIN_TABS.includes(key))
        const more = tabs.filter(([key]) => !MAIN_TABS.includes(key))
        const moreActive = more.some(([key]) => key === tab)
        const showMore = moreOpen || moreActive
        const tabButton = ([key, label]) => (
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
        )
        return (
          <>
            <div className="version-tabs" role="tablist">
              {main.map(tabButton)}
              {more.length > 0 && (
                <button
                  type="button"
                  className={`version-tab${moreActive ? ' active' : ''}`}
                  aria-expanded={showMore}
                  onClick={() => setMoreOpen(!showMore)}
                >
                  More {showMore ? '▴' : '▾'}
                </button>
              )}
            </div>
            {showMore && (
              <div className="version-tabs" role="tablist" aria-label="More about this project" style={{ marginTop: -6 }}>
                {more.map(tabButton)}
              </div>
            )}
          </>
        )
      })()}

      {tab === 'overview' && (
        <>
          <ProjectOverview {...tabProps} />
          <WorkflowPanel orgId={orgId} subject={{ type: SUBJECT_TYPES.project, id: project.id }} />
        </>
      )}
      {tab === 'workstreams' && <ProjectWorkstreams {...tabProps} />}
      {tab === 'insights' && <ProjectInsights project={project} />}
      {tab === 'tasks' && <ProjectTasks {...tabProps} />}
      {tab === 'board' && (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            Divide the project's work into modules and track them across columns. Drag a module to reorder it or move it on; open
            one to link the tasks it covers.
            {project.client?.id && (
              <>
                {' '}
                <Link to={`/customer-boards/${project.client.id}`}>See all of this customer's projects on one board →</Link>
              </>
            )}
          </p>
          <BoardView key={`${orgId}-${project.id}`} orgId={orgId} workUnitId={project.id} names={names} />
        </>
      )}
      {tab === 'milestones' && (
        <>
          <ProjectMilestones {...tabProps} />
          <ProjectWorkPackages {...tabProps} />
        </>
      )}
      {tab === 'team' && <ProjectTeam {...tabProps} />}
      {tab === 'risks' && <ProjectRisks {...tabProps} />}
      {tab === 'changes' && <ProjectChangeRequests {...tabProps} />}
      {tab === 'documents' && params.get('attach') === 'failed' && (
        <div className="alert warn">The project was made, but the sale’s proposal and quotation couldn’t be attached. Attach them here.</div>
      )}
      {tab === 'documents' && (
        hasAccess(me, ACCESS.documents) ? (
          <DocumentPanel
            orgId={orgId}
            subjectType={DOCUMENT_SUBJECTS.project}
            subjectId={project.id}
            canAttach={canAttach}
            defaultCategory="deliverable"
            title="Project Documents"
            emptyText="No documents attached to this project yet."
          />
        ) : (
          <div className="panel muted">You do not have access to view documents.</div>
        )
      )}
    </div>
  )
}
