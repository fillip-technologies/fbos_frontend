import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import Handovers from '@/features/delivery/components/Handovers.jsx'
import TaskBoard from '@/features/delivery/components/TaskBoard.jsx'
import TaskFilterBar, { NO_TASK_FILTERS } from '@/features/delivery/components/TaskFilterBar.jsx'
import TaskTable from '@/features/delivery/components/TaskTable.jsx'
import Timesheet from '@/features/delivery/components/Timesheet.jsx'
import WorkQueue from '@/features/delivery/components/WorkQueue.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import useTaskTypes from '@/features/delivery/useTaskTypes.js'
import { OPEN_TASK_STATUSES, TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// One task engine, several ways to work it: a list, a board (agile teams, review pipelines),
// a queue worked one task at a time (sales cadences, service desks), time, and handovers.
const TABS = [
  ['mine', 'My work'],
  ['board', 'Board'],
  ['queue', 'Queue'],
  ['all', 'All tasks'],
  ['timesheet', 'Timesheet'],
  ['handovers', 'Handovers', ACCESS.handovers],
]

export default function Tasks() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const { active: taskTypes } = useTaskTypes(orgId)
  const [params, setParams] = useSearchParams()
  const tabs = TABS.filter(([, , rule]) => !rule || hasAccess(me, rule))
  const tab = tabs.some(([key]) => key === params.get('view')) ? params.get('view') : 'mine'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Work to do in {activeOrg ? `“${activeOrg.name}”` : 'this company'}, and the time spent on it.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {hasAccess(me, ACCESS.deliverySetup) && <Link className="btn secondary" to="/task-types">Task types</Link>}
          {hasAccess(me, ACCESS.requestWork) && <Link className="btn secondary" to="/requests/new">Ask another team</Link>}
          {hasAccess(me, ACCESS.manageTasks) && <Link className="btn" to="/tasks/new">+ New task</Link>}
        </div>
      </div>

      <div className="version-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'mine' ? {} : { view: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <>
          <TaskList key={`mine-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} mine />
          <TeamQueue key={`team-queue-${orgId}`} orgId={orgId} names={names} />
        </>
      )}
      {tab === 'board' && <TaskBoard key={`board-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
      {tab === 'queue' && <WorkQueue key={`queue-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
      {tab === 'all' && <TaskList key={`all-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
      {tab === 'timesheet' && <Timesheet orgId={orgId} names={names} />}
      {tab === 'handovers' && <Handovers key={orgId} orgId={orgId} names={names} />}
    </div>
  )
}

// My work, second half: what waits in the queues of the teams I belong to (my home unit and my
// extra teams, with the units above them), nearest due first, to open and take.
const TEAM_QUEUE_SIZE = 10

function TeamQueue({ orgId, names }) {
  const query = { unassigned: true, my_teams: true, status: OPEN_TASK_STATUSES }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['tasks', orgId, { query, size: TEAM_QUEUE_SIZE }],
    ({ signal }) => tasksApi.list(orgId, { limit: TEAM_QUEUE_SIZE, ...query }, { signal }),
    { enabled: Boolean(orgId) }
  )
  const tasks = data?.data ?? []
  return (
    <section style={{ marginTop: 28 }}>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Your teams’ queue</h2>
        <Link className="btn secondary" to="/tasks?view=queue">Work the queue →</Link>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Tasks nobody has taken yet in the teams you belong to. Open one and choose “Take it” to make it yours.
      </p>
      <ErrorBanner error={error} onRetry={reload} />
      <TaskTable
        orgId={orgId}
        tasks={tasks}
        loading={loading}
        refreshing={refreshing}
        names={names}
        empty="Nothing waiting in your teams’ queues."
      />
      {data?.page?.has_more && (
        <p className="muted small">Showing the first {TEAM_QUEUE_SIZE}. The queue view has the rest.</p>
      )}
    </section>
  )
}

function TaskList({ orgId, names, taskTypes, mine = false }) {
  const [filters, setFilters] = useState({ ...NO_TASK_FILTERS, status: '', overdue: false })
  const [showFinished, setShowFinished] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  // My tasks: what's still to do unless asked otherwise. All tasks: as filtered.
  const status = filters.status || (mine && !showFinished ? OPEN_TASK_STATUSES : '')
  const query = { ...filters, status, overdue: filters.overdue || '', ...(mine ? { assignee: 'me' } : {}) }
  const { data, error, loading, refreshing, reload } = useQuery(
    ['tasks', orgId, { cursor, query }],
    ({ signal }) => tasksApi.list(orgId, { limit: 25, cursor, ...query }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const tasks = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  const setFilter = (key, value) => {
    setCursor(undefined)
    setStack([])
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <>
      <TaskFilterBar filters={filters} setFilter={setFilter} names={names} taskTypes={taskTypes} hide={mine ? ['assignee', 'owning_unit_id'] : []}>
        <select aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">{mine && !showFinished ? 'Still to do' : 'All statuses'}</option>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {mine ? (
          <label className="inline-check">
            <input type="checkbox" checked={showFinished} onChange={(e) => { setCursor(undefined); setStack([]); setShowFinished(e.target.checked) }} />
            Show finished
          </label>
        ) : (
          <label className="inline-check">
            <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilter('overdue', e.target.checked)} />
            Overdue only
          </label>
        )}
      </TaskFilterBar>

      <ErrorBanner error={error} onRetry={reload} />
      <TaskTable
        orgId={orgId}
        tasks={tasks}
        loading={loading}
        refreshing={refreshing}
        names={names}
        empty={mine ? 'Nothing assigned to you. Nice.' : 'No tasks found.'}
      />
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => {
            setCursor(stack[stack.length - 1])
            setStack(stack.slice(0, -1))
          }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => {
            setStack([...stack, cursor])
            setCursor(next)
          }}
        >
          Next →
        </button>
      </div>
    </>
  )
}
