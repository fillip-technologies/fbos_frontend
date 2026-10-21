import { Link } from 'react-router-dom'
import { inventoryReportsApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { LOCATION_TYPE_LABELS, formatDay as formatDate } from '@/features/inventory/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

function Report({ orgId, name, title, columns, row, empty }) {
  const { data, error, loading, reload } = useQuery(['inventory-report', orgId, name], ({ signal }) => inventoryReportsApi.get(orgId, name, {}, { signal }), { enabled: Boolean(orgId) })
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? <PanelSkeleton lines={3} /> : !data?.length ? <p className="muted small">{empty}</p> : (
        <table>
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{data.map((r, n) => <tr key={n}>{row(r).map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
        </table>
      )}
    </div>
  )
}

const device = (d) => (d ? <Link className="mono" to={`/inventory/devices/${d.id}`}>{d.code}</Link> : '—')

// The design doc's standing questions, answered from live data (operator staff only).
export default function InventoryReports() {
  const { orgId } = useActiveOrg()
  return (
    <div>
      <div className="page-head">
        <div><h1>Inventory reports</h1></div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>
      <Report orgId={orgId} name="by-state" title="Devices by state" columns={['State', 'Devices']} row={(r) => [<LifecycleBadge key="s" state={r.lifecycle_state} />, r.quantity]} empty="No devices." />
      <Report orgId={orgId} name="stock-on-hand" title="Stock on hand" columns={['Where', 'Kind', 'Model', 'Qty']} row={(r) => [r.location.name, LOCATION_TYPE_LABELS[r.location.location_type], r.model.name, r.quantity]} empty="Nothing in stock." />
      <Report orgId={orgId} name="warranty-expiry" title="Warranties ending in 60 days" columns={['Device', 'Ends', 'Cover', 'Vendor']} row={(r) => [device(r.device), formatDate(r.end_date), r.warranty_type, r.vendor_name ?? '—']} empty="None ending soon." />
      <Report orgId={orgId} name="open-repairs" title="Out for repair" columns={['Order', 'Device', 'Kind', 'Status', 'Vendor', 'Sent']} row={(r) => [r.repair_number, device(r.device), r.repair_type, r.status, r.vendor_name ?? 'In-house', formatDate(r.sent_at)]} empty="Nothing out for repair." />
      <Report orgId={orgId} name="repeat-failures" title="Repeat failures (12 months)" columns={['Device', 'Issues', 'Repairs']} row={(r) => [device(r.device), r.issues, r.repair_count]} empty="No device failed twice." />
      <Report orgId={orgId} name="transfers-in-transit" title="In transit" columns={['Transfer', 'From', 'To', 'Devices', 'Dispatched', 'Tracking']} row={(r) => [<Link key="t" to={`/inventory/transfers/${r.id}`}>{r.transfer_number}</Link>, r.from, r.to, r.devices, formatDate(r.dispatched_at), r.tracking_number ?? '—']} empty="Nothing on the road." />
    </div>
  )
}
