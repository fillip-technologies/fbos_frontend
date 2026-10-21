import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { inventoryPlacesApi, repairsApi } from '@/features/inventory/api.js'
import ActionForm from '@/features/inventory/components/ActionForm.jsx'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS, formatDay as formatDate, formatMoneyValue } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const VIEWS = { open: 'requested,approved,sent', done: 'closed,cancelled' }

// The out-for-repair board: each order's next step is a button on its row.
export default function Repairs() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [view, setView] = useState('open')
  const [closing, setClosing] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const dispatchKeys = useMemo(() => new Map(), [])
  const { data, error: loadError, loading, refreshing, reload } = useQuery(['repair-orders', orgId, view], ({ signal }) => repairsApi.list(orgId, { limit: 100, status: VIEWS[view] }, { signal }), { enabled: Boolean(orgId), keepPrevious: true })
  const locations = useLookup(['stock-locations', orgId], ({ signal }) => inventoryPlacesApi.locations(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const stores = (locations.data ?? []).filter((l) => ['platform_warehouse', 'company_store', 'client_store'].includes(l.location_type))
  const canWrite = hasAccess(me, ACCESS.manageRepairOrders)

  async function act(name, call) {
    setBusy(name)
    setError(null)
    try {
      await call()
      invalidate(['repair-orders', orgId])
      invalidate(['devices', orgId])
      setClosing(null)
      reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }
  const keyFor = (id) => dispatchKeys.get(id) ?? dispatchKeys.set(id, uuidv4()).get(id)
  const rows = data?.data ?? []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Repairs</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Devices out at the bench, a service centre or the vendor. Start one from the device's page.</p>
        </div>
        <div className="row-actions"><OrgSwitcher /></div>
      </div>
      <div className="version-tabs" role="tablist">
        {[['open', 'Open'], ['done', 'Done']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`version-tab${view === key ? ' active' : ''}`} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>
      <ErrorBanner error={error || loadError} onRetry={reload} />
      {closing && (
        <ActionForm title={`Close ${closing.repair_number}`} busy={busy} onCancel={() => setClosing(null)}
          fields={[
            { name: 'outcome', label: 'Outcome', required: true, options: [['repaired', 'Repaired'], ['replaced_by_vendor', 'Replaced by the vendor'], ['beyond_repair', 'Beyond repair (retire it)']] },
            { name: 'return_location_id', label: 'Comes back to (unless beyond repair)', options: stores.map((l) => [l.id, l.name]) },
            { name: 'final_cost', label: 'Final cost', type: 'number' },
          ]}
          onSubmit={(v) => act('close', () => repairsApi.close(orgId, closing, { ...v, final_cost: v.final_cost ? Number(v.final_cost) : undefined }))} />
      )}
      <div className={`panel${refreshing ? ' is-refreshing' : ''}`} style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Order</th><th>Device</th><th>Where to</th><th>Status</th><th>Cost</th><th /></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
              <tr><td colSpan={6} className="center-note">Nothing out for repair.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td><div className="mono">{r.repair_number}</div><div className="muted small">{REPAIR_TYPE_LABELS[r.repair_type]}{r.is_warranty_claim && ' · warranty claim'}{r.rma_number && ` · RMA ${r.rma_number}`}</div></td>
                <td><Link className="mono" to={`/inventory/devices/${r.device.id}`}>{r.device.code}</Link> <LifecycleBadge state={r.device.lifecycle_state} /></td>
                <td>{r.vendor?.name ?? 'In-house bench'}{r.issue && <div className="small"><Link to={`/inventory/issues/${r.issue.id}`}>{r.issue.issue_number}</Link></div>}</td>
                <td><StatusBadge status={r.status === 'sent' ? 'in_progress' : r.status} label={REPAIR_STATUS_LABELS[r.status]} />{r.outcome && <div className="muted small">{r.outcome.replace(/_/g, ' ')}</div>}</td>
                <td>{formatMoneyValue(r.final_cost ?? r.cost_estimate) ?? <span className="muted">—</span>}{r.sent_at && <div className="muted small">sent {formatDate(r.sent_at)}</div>}</td>
                <td>
                  <div className="row-actions">
                    {r.status === 'requested' && hasAccess(me, ACCESS.approveRepairOrders) && <button className="btn" disabled={!!busy} onClick={() => act('approve', () => repairsApi.approve(orgId, r))}>Approve</button>}
                    {r.status === 'approved' && canWrite && <button className="btn" disabled={!!busy} onClick={() => act('dispatch', () => repairsApi.dispatch(orgId, r, {}, keyFor(r.id)))}>Send</button>}
                    {r.status === 'sent' && r.outbound_transfer?.status === 'dispatched' && canWrite && <button className="btn secondary" disabled={!!busy} onClick={() => act('arrived', () => repairsApi.arrived(orgId, r))}>Arrived there</button>}
                    {r.status === 'sent' && canWrite && <button className="btn" onClick={() => setClosing(r)}>Close</button>}
                    {['requested', 'approved'].includes(r.status) && canWrite && <button className="btn secondary" disabled={!!busy} onClick={() => act('cancel', () => repairsApi.cancel(orgId, r))}>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
