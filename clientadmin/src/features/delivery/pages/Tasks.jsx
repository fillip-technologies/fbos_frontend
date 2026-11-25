import '@/features/delivery/tasks.css'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import Handovers from '@/features/delivery/components/Handovers.jsx'
import TeamOverview from '@/features/delivery/components/TeamOverview.jsx'
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

// One task engine, three places to start: what is mine, what the team is doing, and the time spent.
// The team's work can be looked at as a list, a board, a pile to pick up, or work passed over.
const TABS = [
  ['mine', 'My tasks'],
  ['team', 'All tasks'],
  ['time', 'Time'],
]
const TEAM_VIEWS = [
  ['list', 'List'],
  ['board', 'Board'],
  ['queue', 'Pick up unassigned'],
  ['handovers', 'Passed to my team', ACCESS.handovers],
]
// Links from before the tabs were folded together (?view=board, ?view=handovers…) still land in the right place.
const LEGACY_VIEWS = { board: ['team', 'board'], all: ['team', 'list'], queue: ['team', 'queue'], handovers: ['team', 'handovers'], timesheet: ['time', null] }

export default function Tasks() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const { active: taskTypes } = useTaskTypes(orgId)
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const [legacyTab, legacyShow] = LEGACY_VIEWS[raw] ?? []
  // Whoever manages tasks (an admin) lands on everyone's tasks; others on their own.
  const homeTab = hasAccess(me, ACCESS.manageTasks) ? 'team' : 'mine'
  const tab = TABS.some(([key]) => key === raw) ? raw : legacyTab ?? homeTab
  const teamViews = TEAM_VIEWS.filter(([, , rule]) => !rule || hasAccess(me, rule))
  const wanted = params.get('show') ?? legacyShow
  const show = teamViews.some(([key]) => key === wanted) ? wanted : 'list'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everyone's work (All tasks), what is yours to do (My tasks), and the time spent, in {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {hasAccess(me, ACCESS.deliverySetup) && <Link className="btn secondary" to="/task-types">Task types</Link>}
          {hasAccess(me, ACCESS.requestWork) && <Link className="btn secondary" to="/requests/new">Ask another team</Link>}
          {hasAccess(me, ACCESS.personalTasks) && <Link className="btn secondary" to="/tasks/new?personal=1">+ Task for me</Link>}
          {hasAccess(me, ACCESS.manageTasks) && <Link className="btn" to="/tasks/new">+ New task</Link>}
        </div>
      </div>

      <div className="version-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === homeTab ? {} : { view: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <>
          <MyStrip key={`strip-${orgId}`} orgId={orgId} />
          <TaskList key={`mine-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} mine />
          <TeamQueue key={`team-queue-${orgId}`} orgId={orgId} names={names} />
        </>
      )}
      {tab === 'team' && (
        <>
          {(show === 'list' || show === 'board') && <TeamOverview key={`ov-${orgId}`} orgId={orgId} names={names} />}
          <div className="segmented task-views" role="group" aria-label="Look at the team's work as">
            {teamViews.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={show === key ? 'active' : ''}
                aria-pressed={show === key}
                onClick={() => setParams({ ...(homeTab === 'team' ? {} : { view: 'team' }), ...(key === 'list' ? {} : { show: key }) }, { replace: true })}
              >
                {label}
              </button>
            ))}
          </div>
          {show === 'list' && <TaskList key={`all-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
          {show === 'board' && <TaskBoard key={`board-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
          {show === 'queue' && <WorkQueue key={`queue-${orgId}`} orgId={orgId} names={names} taskTypes={taskTypes} />}
          {show === 'handovers' && <Handovers key={orgId} orgId={orgId} names={names} />}
        </>
      )}
      {tab === 'time' && <Timesheet orgId={orgId} names={names} />}
    </div>
  )
}

// My tasks, at a glance: how many are open, due today and late, drawn as bars against what is open.
function MyStrip({ orgId }) {
  const { data } = useQuery(['tasks', orgId, 'my-summary'], ({ signal }) => tasksApi.mySummary(orgId, { signal }), { enabled: Boolean(orgId) })
  if (!data) return null
  const open = Number(data.assigned_open) || 0
  const parts = [
    { key: 'open', label: 'Open', value: open, share: open ? 1 : 0, tone: '' },
    { key: 'today', label: 'Due today', value: Number(data.due_today) || 0, share: open ? (Number(data.due_today) || 0) / open : 0, tone: 'warn' },
    { key: 'late', label: 'Overdue', value: Number(data.overdue) || 0, share: open ? (Number(data.overdue) || 0) / open : 0, tone: 'bad' },
  ]
  return (
    <div className="task-strip" aria-label="Your tasks at a glance">
      {parts.map((p) => (
        <div key={p.key} className={`task-strip-item ${p.tone}`}>
          <span className="task-strip-label">{p.label}</span>
          <strong>{p.value}</strong>
          <span className="task-strip-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, p.share * 100)}%` }} /></span>
        </div>
      ))}
    </div>
  )
}

// My tasks, second half: tasks nobody has taken yet in the teams I belong to (my home unit and my
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
        <h2 style={{ margin: 0, fontSize: 17 }}>Unassigned in your teams</h2>
        <Link className="btn secondary" to="/tasks?view=team&show=queue">Pick up tasks →</Link>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Nobody has taken these yet. Open one and choose “Take it” to make it yours.
      </p>
      <ErrorBanner error={error} onRetry={reload} />
      <TaskTable
        orgId={orgId}
        tasks={tasks}
        loading={loading}
        refreshing={refreshing}
        names={names}
        empty="Nothing unassigned in your teams."
      />
      {data?.page?.has_more && (
        <p className="muted small">Showing the first {TEAM_QUEUE_SIZE}. “Pick up unassigned” under Team has the rest.</p>
      )}
    </section>
  )
}

function TaskList({ orgId, names, taskTypes, mine = false }) {
  const [filters, setFilters] = useState({ ...NO_TASK_FILTERS, status: '', overdue: false, personal: false })
  const [showFinished, setShowFinished] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  // My tasks: what's still to do unless asked otherwise. All tasks: as filtered.
  const status = filters.status || (mine && !showFinished ? OPEN_TASK_STATUSES : '')
  const query = { ...filters, status, overdue: filters.overdue || '', personal: filters.personal || '', ...(mine ? { assignee: 'me' } : {}) }
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
        <label className="inline-check" title="Tasks with no team, kept by whoever added them">
          <input type="checkbox" checked={filters.personal} onChange={(e) => setFilter('personal', e.target.checked)} />
          Personal only
        </label>
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
