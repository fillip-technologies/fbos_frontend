import { useState } from 'react'
import { capacityApi } from '@/features/management/api.js'
import { hours, percent, personName, thisMonth } from '@/features/management/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDate } from '@/shared/utils/format.js'

// How much time people have, how much is booked, and who has none booked.
export default function Capacity() {
  const { orgId } = useActiveOrg()
  const initial = thisMonth()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)

  const utilization = useQuery(['mgmt-utilization', orgId, from, to], ({ signal }) => capacityApi.utilization(orgId, { from, to }, { signal }), {
    enabled: Boolean(orgId && from && to && from <= to),
    keepPrevious: true,
  })
  const bench = useQuery(['mgmt-bench', orgId], ({ signal }) => capacityApi.bench(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const rows = utilization.data?.data ?? []
  const totals = utilization.data?.totals

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Capacity</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Working time against bookings, per person.</p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
      </div>
      <ErrorBanner error={utilization.error || bench.error} onRetry={utilization.reload} />

      {utilization.data && !utilization.data.actuals_available && (
        <div className="alert">Recorded time isn't available right now, so only planned utilization is shown.</div>
      )}

      {totals && (
        <div className="stat-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat label="Capacity" value={hours(totals.capacity_minutes)} />
          <Stat label="Booked" value={hours(totals.allocated_minutes)} sub={percent(totals.planned_pct)} />
          <Stat label="Recorded" value={hours(totals.recorded_minutes)} sub={percent(totals.total_pct)} />
          <Stat label="Billable" value={percent(totals.billable_pct)} />
        </div>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Person</th><th>Capacity</th><th>Booked</th><th>Planned</th><th>Recorded</th><th>Billable</th><th>Productive</th></tr></thead>
          <tbody>
            {utilization.loading ? <TableSkeleton cols={7} /> : rows.length === 0 ? (
              <tr><td colSpan={7} className="center-note">No resources in this window.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.resource_id}>
                <td>{personName(r.user)}</td>
                <td>{hours(r.capacity_minutes)}</td>
                <td>{hours(r.allocated_minutes)}</td>
                <td>{percent(r.planned_pct)}</td>
                <td>{hours(r.recorded_minutes)}</td>
                <td>{percent(r.billable_pct)}</td>
                <td>{percent(r.productive_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>Bench</h2>
      <p className="muted small">People with no confirmed booking for the next ten working days{bench.data ? ` (from ${formatDate(bench.data.as_of)})` : ''}.</p>
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Person</th><th>Unit</th><th>Soft booked</th><th>Next confirmed booking</th></tr></thead>
          <tbody>
            {bench.loading ? <TableSkeleton cols={4} rows={3} /> : (bench.data?.data ?? []).length === 0 ? (
              <tr><td colSpan={4} className="center-note">Nobody is on the bench.</td></tr>
            ) : bench.data.data.map((r) => (
              <tr key={r.resource_id}>
                <td>{personName(r.user)}</td>
                <td>{r.unit?.name || <span className="muted">—</span>}</td>
                <td>{r.soft_booked ? <StatusBadge status="proposed" label="Yes" /> : 'No'}</td>
                <td>{formatDate(r.next_confirmed_start)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="panel" style={{ minWidth: 140 }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
