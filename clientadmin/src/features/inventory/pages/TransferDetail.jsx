import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { transfersApi } from '@/features/inventory/api.js'
import { LifecycleBadge } from '@/features/inventory/components/LifecycleBadge.jsx'
import { TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS, transferTone } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDay as formatDate } from '@/features/inventory/utils.js'

export default function TransferDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [shipping, setShipping] = useState({ challan_no: '', carrier: '', tracking_number: '' })
  const [outcomes, setOutcomes] = useState({})
  const dispatchKey = useMemo(() => uuidv4(), [])
  const { data: t, error: loadError, loading, reload, setData } = useQuery(
    ['stock-transfer', orgId, id],
    ({ signal }) => transfersApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )
  if (loading) return <DetailSkeleton />
  if (!t) return <ErrorBanner error={loadError} onRetry={reload} />

  async function act(name, call) {
    setBusy(name)
    setError(null)
    try {
      setData(await call())
      invalidate(['stock-transfers', orgId])
      invalidate(['devices', orgId])
      invalidate(['stock-locations', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }
  const receiveBody = () => ({
    items: Object.entries(outcomes).filter(([, s]) => s !== 'received').map(([device_id, status]) => ({ device_id, status })),
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><span className="mono">{t.transfer_number}</span> <StatusBadge status={transferTone(t.status)} label={TRANSFER_STATUS_LABELS[t.status]} /></h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {TRANSFER_TYPE_LABELS[t.transfer_type]} · {t.from_location.name} → {t.to_location.name} · created {formatDate(t.created_at)}
          </p>
        </div>
        <div className="row-actions">
          {t.status === 'draft' && hasAccess(me, ACCESS.approveStockTransfers) && (
            <button className="btn" disabled={!!busy} aria-busy={busy === 'approve'} onClick={() => act('approve', () => transfersApi.approve(orgId, t))}>Approve</button>
          )}
          {['draft', 'approved'].includes(t.status) && hasAccess(me, ACCESS.manageStockTransfers) && (
            <button className="btn secondary" disabled={!!busy} onClick={() => act('cancel', () => transfersApi.cancel(orgId, t))}>Cancel transfer</button>
          )}
          <button className="btn secondary" onClick={() => navigate('/inventory/transfers')}>← Back</button>
        </div>
      </div>
      <ErrorBanner error={error} />

      {t.status === 'approved' && hasAccess(me, ACCESS.dispatchStockTransfers) && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Dispatch</h2>
          <div className="grid-3">
            <label className="field"><span>Delivery challan</span><input value={shipping.challan_no} onChange={(e) => setShipping({ ...shipping, challan_no: e.target.value })} /></label>
            <label className="field"><span>Carrier</span><input value={shipping.carrier} onChange={(e) => setShipping({ ...shipping, carrier: e.target.value })} /></label>
            <label className="field"><span>Tracking number</span><input value={shipping.tracking_number} onChange={(e) => setShipping({ ...shipping, tracking_number: e.target.value })} /></label>
          </div>
          <button className="btn" disabled={!!busy} aria-busy={busy === 'dispatch'}
            onClick={() => act('dispatch', () => transfersApi.dispatch(orgId, t, Object.fromEntries(Object.entries(shipping).filter(([, v]) => v)), dispatchKey))}>
            Mark dispatched
          </button>
        </div>
      )}

      <div className="panel" style={{ padding: 0, overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead><tr><th>Device</th><th>Now</th><th>Item</th><th>Condition</th>{t.status === 'dispatched' && <th>Arrived as</th>}</tr></thead>
          <tbody>
            {t.items.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/inventory/devices/${i.device.id}`} className="mono">{i.device.code}</Link>{i.device.serial_number && <span className="muted small"> · S/N {i.device.serial_number}</span>}</td>
                <td><LifecycleBadge state={i.device.lifecycle_state} /></td>
                <td className="small">{i.item_status.replace('_', ' ')}</td>
                <td className="small">{i.condition_out}{i.condition_in && ` → ${i.condition_in}`}</td>
                {t.status === 'dispatched' && (
                  <td>
                    <select value={outcomes[i.device.id] ?? 'received'} onChange={(e) => setOutcomes({ ...outcomes, [i.device.id]: e.target.value })}>
                      <option value="received">Received OK</option>
                      <option value="damaged">Damaged</option>
                      <option value="missing">Missing</option>
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.status === 'dispatched' && hasAccess(me, ACCESS.receiveStockTransfers) && (
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={!!busy} aria-busy={busy === 'receive'} onClick={() => act('receive', () => transfersApi.receive(orgId, t, receiveBody()))}>
            Check in at {t.to_location.name}
          </button>
          {t.tracking_number && <span className="muted small">Tracking {t.tracking_number}{t.carrier && ` · ${t.carrier}`}</span>}
        </div>
      )}
    </div>
  )
}
