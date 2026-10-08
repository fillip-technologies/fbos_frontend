import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestsApi } from '@/features/delivery/api.js'
import TaskTable from '@/features/delivery/components/TaskTable.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { OPEN_TASK_STATUSES } from '@/features/delivery/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

// My requests: the work I asked other teams for, to follow it. Each one is a task in the
// receiving team's queue; I watch it, and it is mine to see even when my task access covers
// only my own tasks.
export default function Requests() {
  const { orgId, activeOrg } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const [showFinished, setShowFinished] = useState(false)
  const [cursor, setCursor] = useState(undefined)
  const [stack, setStack] = useState([])
  const enabled = Boolean(orgId)

  const status = showFinished ? '' : OPEN_TASK_STATUSES
  const { data, error, loading, refreshing, reload } = useQuery(
    ['requests', orgId, { cursor, status }],
    ({ signal }) => requestsApi.mine(orgId, { limit: 25, cursor, status }, { signal }),
    { enabled, keepPrevious: true }
  )
  const { data: requestable } = useLookup(['requestable-types', orgId], ({ signal }) => requestsApi.types(orgId, { signal }), { enabled })
  const requests = data?.data ?? []
  const next = data?.page?.has_more ? data.page.next_cursor : null
  const nothingRequestable = requestable && requestable.data.length === 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My requests</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Work you asked other teams for in {activeOrg ? `“${activeOrg.name}”` : 'this company'}.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher />
          {!nothingRequestable && <Link className="btn" to="/requests/new">+ New request</Link>}
        </div>
      </div>

      {nothingRequestable && (
        <div className="alert info">
          No team takes requests yet. An admin opens a kind of work to requests with a routing rule on the Task types page.
        </div>
      )}

      <label className="inline-check" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showFinished}
          onChange={(e) => { setCursor(undefined); setStack([]); setShowFinished(e.target.checked) }}
        />
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
    </div>
  )
}
