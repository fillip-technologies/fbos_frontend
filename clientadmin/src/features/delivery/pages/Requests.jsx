import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestsApi, tasksApi } from '@/features/delivery/api.js'
import TaskTable from '@/features/delivery/components/TaskTable.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { OPEN_TASK_STATUSES } from '@/features/delivery/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// Work between teams, both ways in one place: what I asked other teams for, and what other teams
// asked of mine. Each request is a task in the receiving team's queue; the asker watches it.
export default function Requests() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const [params, setParams] = useSearchParams()
  const incoming = params.get('show') === 'incoming'
  const enabled = Boolean(orgId)
  const myUnits = [...new Set([me?.home_unit?.id, ...(me?.teams ?? []).map((t) => t.id)].filter(Boolean))]
  const canSeeTasks = hasAccess(me, ACCESS.tasks)

  const { data: requestable } = useLookup(['requestable-types', orgId], ({ signal }) => requestsApi.types(orgId, { signal }), { enabled })
  const nothingRequestable = requestable && requestable.data.length === 0

  // How many are waiting for my team, to show on its tab.
  const waiting = useIncoming(orgId, myUnits, enabled && canSeeTasks && myUnits.length > 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Requests between teams</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Work you asked other teams for, and work other teams asked of yours, in {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {!nothingRequestable && <Link className="btn" to="/requests/new">+ New request</Link>}
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Which requests" style={{ marginBottom: 14 }}>
        <button type="button" className={incoming ? '' : 'active'} aria-pressed={!incoming} onClick={() => setParams({}, { replace: true })}>
          I asked
        </button>
        <button type="button" className={incoming ? 'active' : ''} aria-pressed={incoming} onClick={() => setParams({ show: 'incoming' }, { replace: true })}>
          Asked of my team{waiting.tasks.length > 0 ? ` (${waiting.tasks.length})` : ''}
        </button>
      </div>

      {nothingRequestable && (
        <div className="alert info">
          No team takes requests yet. An admin opens a kind of work to requests with a routing rule on the Task types page.
        </div>
      )}

      {incoming ? (
        <Incoming orgId={orgId} names={names} state={waiting} hasTeam={myUnits.length > 0} canSeeTasks={canSeeTasks} />
      ) : (
        <Sent orgId={orgId} names={names} />
      )}
    </div>
  )
}

// What I asked: a page of tasks I created through a request, newest first.
function Sent({ orgId, names }) {
  const [showFinished, setShowFinished] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const status = showFinished ? '' : OPEN_TASK_STATUSES
  const { data, error, loading, refreshing, reload } = useQuery(
    ['requests', orgId, { cursor, status }],
    ({ signal }) => requestsApi.mine(orgId, { limit: 25, cursor, status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const requests = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null

  return (
    <>
      <label className="inline-check" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={showFinished} onChange={(e) => { setCursor(undefined); setStack([]); setShowFinished(e.target.checked) }} />
        Show finished
      </label>
      <ErrorBanner error={error} onRetry={reload} />
      <TaskTable
        orgId={orgId}
        tasks={requests}
        loading={loading}
        refreshing={refreshing}
        names={names}
        empty={showFinished ? 'You haven’t asked other teams for anything yet.' : 'None of your requests are still open.'}
      />
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button
          className="btn secondary"
          disabled={loading || refreshing || stack.length === 0}
          onClick={() => { setCursor(stack[stack.length - 1]); setStack(stack.slice(0, -1)) }}
        >
          ← Previous
        </button>
        <button
          className="btn secondary"
          disabled={loading || refreshing || !next}
          onClick={() => { setStack([...stack, cursor]); setCursor(next) }}
        >
          Next →
        </button>
      </div>
    </>
  )
}

// What other teams asked of mine: the still-open tasks of my teams that came from a request. Delivery
// has no filter for this yet, so they are picked out of the teams' open tasks here.
function useIncoming(orgId, unitIds, enabled) {
  const { data, error, loading, refreshing, reload } = useQuery(
    ['requests', orgId, 'incoming', unitIds],
    async ({ signal }) => {
      const pages = await Promise.all(
        unitIds.map((unit) => tasksApi.list(orgId, { limit: 100, owning_unit_id: unit, status: OPEN_TASK_STATUSES }, { signal }))
      )
      const seen = new Set()
      return pages
        .flatMap((page) => page.data)
        .filter((task) => task.source === 'request' && !seen.has(task.id) && seen.add(task.id))
        .sort((a, b) => b.code.localeCompare(a.code))
    },
    { enabled, keepPrevious: true }
  )
  return { tasks: data ?? [], error, loading, refreshing, reload }
}

function Incoming({ orgId, names, state, hasTeam, canSeeTasks }) {
  if (!hasTeam) return <div className="panel muted">You are not in a team yet, so no team’s requests come to you.</div>
  if (!canSeeTasks) return <div className="panel muted">You don’t have access to tasks.</div>
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        Open one and choose “Take it” to make it yours. Work passed over as a whole is under Tasks → “Passed to my team”.
      </p>
      <ErrorBanner error={state.error} onRetry={state.reload} />
      <TaskTable
        orgId={orgId}
        tasks={state.tasks}
        loading={state.loading}
        refreshing={state.refreshing}
        names={names}
        showAsker
        empty="No other team is waiting on yours."
      />
    </>
  )
}
