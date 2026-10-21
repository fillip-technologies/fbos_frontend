import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { transfersApi } from '@/features/inventory/api.js'
import { TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS, transferTone } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDay as formatDate } from '@/features/inventory/utils.js'

const VIEWS = {
  open: { label: 'Open', status: 'draft,approved,dispatched' },
  transit: { label: 'In transit', status: 'dispatched' },
  done: { label: 'Done', status: 'received,partially_received,cancelled,rejected' },
}

export default function Transfers() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [view, setView] = useState('open')
  const [cursor, setCursor] = useState(undefined)
  const { data, error, loading, refreshing, reload } = useQuery(
    ['stock-transfers', orgId, { view, cursor }],
    ({ signal }) => transfersApi.list(orgId, { limit: 25, cursor, status: VIEWS[view].status }, { signal }),
    { enabled: Boolean(orgId), keepPrevious: true }
  )
  const rows = data?.data ?? []
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Transfers</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Devices moving between the warehouse, customer stores and sites.</p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setCursor(undefined)} />
          {hasAccess(me, ACCESS.manageStockTransfers) && <Link className="btn" to="/inventory/transfers/new">+ New transfer</Link>}
        </div>
      </div>
      <div className="version-tabs" role="tablist">
        {Object.entries(VIEWS).map(([key, v]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`version-tab${view === key ? ' active' : ''}`}
            onClick={() => { setCursor(undefined); setView(key) }}>
            {v.label}
          </button>
        ))}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Transfer</th><th>From → to</th><th>Devices</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={5} /> : rows.length === 0 ? (
              <tr><td colSpan={5} className="center-note">No transfers here.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/inventory/transfers/${t.id}`)}>
                <td><div className="mono">{t.transfer_number}</div><div className="muted small">{TRANSFER_TYPE_LABELS[t.transfer_type]}</div></td>
                <td>{t.from_location.name} → {t.to_location.name}</td>
                <td>{t.item_count}</td>
                <td><StatusBadge status={transferTone(t.status)} label={TRANSFER_STATUS_LABELS[t.status]} /></td>
                <td className="muted small">{formatDate(t.created_at)}</td>
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
