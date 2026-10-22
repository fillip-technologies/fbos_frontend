import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { purchaseOrdersApi } from '@/features/inventory/api.js'
import { PO_STATUS_LABELS, formatMoneyValue, poTone } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDay as formatDate } from '@/features/inventory/utils.js'

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [status, setStatus] = useState('')
  const [cursor, setCursor] = useState(undefined)
  const { data, error, loading, refreshing, reload } = useQuery(
    ['purchase-orders', orgId, { status, cursor }],
    ({ signal }) => purchaseOrdersApi.list(orgId, { limit: 25, cursor, status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const rows = data?.data ?? []
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Purchase orders</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Orders to vendors. Devices are registered when their goods arrive.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setCursor(undefined)} />
          {hasAccess(me, ACCESS.deviceCatalog) && <Link className="btn secondary" to="/inventory/catalog">Models &amp; vendors</Link>}
          {hasAccess(me, ACCESS.managePurchaseOrders) && <Link className="btn" to="/inventory/purchase-orders/new">+ New order</Link>}
        </div>
      </div>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setCursor(undefined); setStatus(e.target.value) }}>
          <option value="">Any status</option>
          {Object.entries(PO_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Order</th><th>Vendor</th><th>Lines</th><th>Total</th><th>Status</th><th>Ordered</th></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No purchase orders yet.</td></tr>
            ) : rows.map((po) => (
              <tr key={po.id} onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}>
                <td className="mono">{po.po_number}</td>
                <td>{po.vendor.name}</td>
                <td>{po.items.reduce((n, i) => n + i.quantity_ordered, 0)} units · {po.items.length} line(s)</td>
                <td>{formatMoneyValue(po.total_amount) ?? <span className="muted">—</span>}</td>
                <td><StatusBadge status={poTone(po.status)} label={PO_STATUS_LABELS[po.status]} /></td>
                <td className="muted small">{formatDate(po.order_date)}</td>
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
