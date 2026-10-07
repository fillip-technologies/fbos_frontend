import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tasksApi } from '@/features/delivery/api.js'
import Handovers from '@/features/delivery/components/Handovers.jsx'
import TaskTable from '@/features/delivery/components/TaskTable.jsx'
import Timesheet from '@/features/delivery/components/Timesheet.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { OPEN_TASK_STATUSES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const TABS = [
  ['mine', 'My tasks'],
  ['all', 'All tasks'],
  ['timesheet', 'Timesheet'],
  ['handovers', 'Handovers', ACCESS.handovers],
]
const NO_FILTERS = { status: '', priority: '', assignee: '', owning_unit_id: '', q: '', overdue: false }

export default function Tasks() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
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

      {tab === 'mine' && <TaskList key={`mine-${orgId}`} orgId={orgId} names={names} mine />}
      {tab === 'all' && <TaskList key={`all-${orgId}`} orgId={orgId} names={names} />}
      {tab === 'timesheet' && <Timesheet orgId={orgId} names={names} />}
      {tab === 'handovers' && <Handovers key={orgId} orgId={orgId} names={names} />}
    </div>
  )
}

function TaskList({ orgId, names, mine = false }) {
  const { user: me } = useAuth()
  const [filters, setFilters] = useState(NO_FILTERS)
  const [showFinished, setShowFinished] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])

  // My tasks: what's still to do unless asked otherwise. All tasks: as filtered.
  const query = mine
    ? { assignee: 'me', status: filters.status || (showFinished ? '' : OPEN_TASK_STATUSES), priority: filters.priority, q: filters.q }
    : { ...filters, overdue: filters.overdue || '' }
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
      <div className="toolbar">
        <input type="search" placeholder="Search title or code" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">{mine && !showFinished ? 'Still to do' : 'All statuses'}</option>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">Any priority</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {!mine && names.people && (
          <select value={filters.assignee} onChange={(e) => setFilter('assignee', e.target.value)}>
            <option value="">Anyone</option>
            {names.people.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
          </select>
        )}
        {!mine && names.units && (
          <select value={filters.owning_unit_id} onChange={(e) => setFilter('owning_unit_id', e.target.value)}>
            <option value="">Any team</option>
            {names.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
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
      </div>

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
