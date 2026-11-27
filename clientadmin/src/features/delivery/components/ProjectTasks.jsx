import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import ProjectServices from '@/features/delivery/components/ProjectServices.jsx'
import TaskTable from '@/features/delivery/components/TaskTable.jsx'
import { OPEN_TASK_STATUSES, SUBJECT_TYPES } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// The project's tasks: what's still to do, or everything.
export default function ProjectTasks({ orgId, project, names }) {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const { active: taskTypes } = useTaskTypes(orgId)
  const operations = taskTypes.filter((t) => t.workflow)
  const [showFinished, setShowFinished] = useState(false)
  const query = {
    limit: 100,
    subject_type: SUBJECT_TYPES.project,
    subject_id: project.id,
    status: showFinished ? '' : OPEN_TASK_STATUSES,
  }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['tasks', orgId, { project: project.id, showFinished }],
    ({ signal }) => tasksApi.list(orgId, query, { signal }),
    { enabled: Boolean(orgId) && hasAccess(me, ACCESS.tasks), keepPrevious: true }
  )

  if (!hasAccess(me, ACCESS.tasks)) return <p className="muted">You don't have access to tasks.</p>
  return (
    <>
      <ProjectServices orgId={orgId} project={project} names={names} />
      <div className="toolbar">
        <label className="inline-check">
          <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
          Show finished tasks
        </label>
        {hasAccess(me, ACCESS.manageTasks) && operations.length > 0 && (
          // The kinds of work that run on a workflow: the form opens on that type, and the team,
          // stages and checklist it was set up with apply.
          <select
            aria-label="Start an operation"
            value=""
            onChange={(e) => e.target.value && navigate(`/tasks/new?project=${project.id}&type=${e.target.value}`)}
          >
            <option value="">Start an operation…</option>
            {operations.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        )}
        {hasAccess(me, ACCESS.manageTasks) && (
          <Link className="btn" to={`/tasks/new?project=${project.id}`}>+ New task</Link>
        )}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <TaskTable
        orgId={orgId}
        tasks={data?.data ?? []}
        loading={loading}
        refreshing={refreshing}
        names={names}
        empty={showFinished ? 'No tasks yet.' : 'Nothing left to do.'}
      />
      {data?.page?.has_more && <p className="muted small">Showing the first 100. Find the rest on the Tasks page.</p>}
    </>
  )
}
