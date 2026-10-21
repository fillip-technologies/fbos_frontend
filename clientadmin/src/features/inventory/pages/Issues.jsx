import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { issuesApi } from '@/features/inventory/api.js'
import { ISSUE_STATUS_LABELS, PRIORITY_LABELS, WARRANTY_STATUS_LABELS, formatDay as formatDate, priorityTone, warrantyTone } from '@/features/inventory/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const VIEWS = {
  open: { label: 'Open', params: { status: 'open,assigned,in_progress,on_hold,reopened' } },
  mine: { label: 'Mine', params: { mine: 'true', status: 'open,assigned,in_progress,on_hold,reopened' } },
  overdue: { label: 'Overdue', params: { overdue: 'true' } },
  done: { label: 'Resolved', params: { status: 'resolved,closed' } },
}

export default function Issues() {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const [view, setView] = useState('open')
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const { data, error, loading, refreshing, reload } = useQuery(
    ['issues', orgId, { view, q, cursor }],
    ({ signal }) => issuesApi.list(orgId, { limit: 25, cursor, q, ...VIEWS[view].params }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const rows = data?.data ?? []
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Device issues</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Faults raised on devices, site visits, replacements. Raise one from the device's page.</p>
        </div>
        <div className="row-actions"><OrgSwitcher onChange={() => setCursor(undefined)} /></div>
      </div>
      <div className="version-tabs" role="tablist">
        {Object.entries(VIEWS).map(([key, v]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`version-tab${view === key ? ' active' : ''}`} onClick={() => { setCursor(undefined); setView(key) }}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search number, device or text" value={q} onChange={(e) => { setCursor(undefined); setQ(e.target.value) }} />
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Issue</th><th>Device</th><th>Priority</th><th>Status</th><th>Warranty</th><th>Technician</th><th>Due</th></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={7} /> : rows.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No issues here.</td></tr>
            ) : rows.map((i) => (
              <tr key={i.id} onClick={() => navigate(`/inventory/issues/${i.id}`)}>
                <td><div className="mono">{i.issue_number}</div><div className="muted small">{i.category.name}</div></td>
                <td><span className="mono">{i.device.code}</span>{i.device.zone && <div className="muted small">{i.device.zone.name}</div>}</td>
                <td><StatusBadge status={priorityTone(i.priority)} label={PRIORITY_LABELS[i.priority]} /></td>
                <td><StatusBadge status={i.status} label={ISSUE_STATUS_LABELS[i.status]} /></td>
                <td><StatusBadge status={warrantyTone(i.warranty_status)} label={WARRANTY_STATUS_LABELS[i.warranty_status]} /></td>
                <td>{i.assigned_technician?.name ?? <span className="muted">Unassigned</span>}</td>
                <td className={i.overdue ? 'error small' : 'muted small'}>{i.sla_due_at ? formatDate(i.sla_due_at) : '—'}{i.overdue && ' · overdue'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.page?.has_more && (
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn secondary" disabled={refreshing} onClick={() => setCursor(data.page.next_cursor)}>Next →</button>
        </div>
      )}
    </div>
  )
}
