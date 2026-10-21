import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { inventoryPlacesApi, purchaseOrdersApi } from '@/features/inventory/api.js'
import { PO_STATUS_LABELS, formatMoneyValue, poTone } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { uuidv4 } from '@/shared/api/http.js'
import { invalidate, useLookup, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { DetailSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import { formatDay as formatDate } from '@/features/inventory/utils.js'

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [receiving, setReceiving] = useState(false)
  const { data: po, error: loadError, loading, reload, setData } = useQuery(
    ['purchase-order', orgId, id],
    ({ signal }) => purchaseOrdersApi.get(orgId, id, { signal }),
    { enabled: Boolean(orgId) }
  )

  if (loading) return <DetailSkeleton />
  if (!po) return <ErrorBanner error={loadError} onRetry={reload} />

  async function move(action) {
    setBusy(action)
    setError(null)
    try {
      setData(await purchaseOrdersApi.move(orgId, po, action))
      invalidate(['purchase-orders', orgId])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const canWrite = hasAccess(me, ACCESS.managePurchaseOrders)
  const receivable = ['approved', 'partially_received'].includes(po.status) && hasAccess(me, ACCESS.receiveGoods)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{po.po_number}</span> <StatusBadge status={poTone(po.status)} label={PO_STATUS_LABELS[po.status]} />
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {po.vendor.name} · ordered {formatDate(po.order_date)}
            {po.expected_date && ` · expected ${formatDate(po.expected_date)}`}
          </p>
        </div>
        <div className="row-actions">
          {po.status === 'draft' && canWrite && <button className="btn" disabled={!!busy} aria-busy={busy === 'submit'} onClick={() => move('submit')}>Submit for approval</button>}
          {po.status === 'submitted' && hasAccess(me, ACCESS.approvePurchaseOrders) && (
            <button className="btn" disabled={!!busy} aria-busy={busy === 'approve'} onClick={() => move('approve')}>Approve</button>
          )}
          {receivable && !receiving && <button className="btn" onClick={() => setReceiving(true)}>Receive goods</button>}
          {['draft', 'submitted', 'approved'].includes(po.status) && po.receipts.length === 0 && canWrite && (
            <button className="btn secondary" disabled={!!busy} onClick={() => move('cancel')}>Cancel order</button>
          )}
          <button className="btn secondary" onClick={() => navigate('/inventory/purchase-orders')}>← Back</button>
        </div>
      </div>
      <ErrorBanner error={error} />

      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Model</th><th>Ordered</th><th>Received</th><th>Unit price</th><th>GST</th><th>Line total</th></tr></thead>
          <tbody>
            {po.items.map((i) => (
              <tr key={i.id}>
                <td>{i.device_model.manufacturer} {i.device_model.name}</td>
                <td>{i.quantity_ordered}</td>
                <td>{i.quantity_received}</td>
                <td>{formatMoneyValue(i.unit_price)}</td>
                <td>{Number(i.tax_percent)}%</td>
                <td>{formatMoneyValue(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
          {po.total_amount && (
            <tfoot>
              <tr><td colSpan={5} style={{ textAlign: 'right' }}>Subtotal</td><td>{formatMoneyValue(po.subtotal)}</td></tr>
              <tr><td colSpan={5} style={{ textAlign: 'right' }}>GST</td><td>{formatMoneyValue(po.tax_total)}</td></tr>
              <tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td><td style={{ fontWeight: 600 }}>{formatMoneyValue(po.total_amount)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>

      {receiving && (
        <ReceiveGoods
          orgId={orgId}
          po={po}
          onCancel={() => setReceiving(false)}
          onDone={() => {
            setReceiving(false)
            reload()
            invalidate(['purchase-order', orgId, id, 'receipts'])
            invalidate(['devices', orgId])
          }}
        />
      )}
      <Receipts orgId={orgId} poId={po.id} />
    </div>
  )
}

function Receipts({ orgId, poId }) {
  const { data } = useQuery(['purchase-order', orgId, poId, 'receipts'], ({ signal }) => purchaseOrdersApi.receipts(orgId, poId, { signal }), { enabled: Boolean(orgId) })
  if (!data?.length) return null
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Goods received</h2>
      {data.map((g) => (
        <div key={g.id} style={{ marginBottom: 12 }}>
          <div>
            <span className="mono">{g.grn_number}</span> · {formatDate(g.received_at)} · {g.receiving_location.name}{' '}
            <StatusBadge status={g.status === 'accepted' ? 'accepted' : g.status === 'rejected' ? 'rejected' : 'pending'} label={g.status.replace('_', ' ')} />
          </div>
          <div className="muted small">
            {g.items.map((i) => `${i.quantity_accepted} accepted${i.quantity_rejected ? `, ${i.quantity_rejected} rejected${i.rejection_reason ? ` (${i.rejection_reason})` : ''}` : ''}`).join(' · ')}
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            {g.devices.map((d, n) => (
              <span key={d.id}>{n > 0 && ', '}<Link to={`/inventory/devices/${d.id}`} className="mono">{d.code}</Link></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// One row per order line: how many arrived, how many pass QC, and one serial per accepted unit.
function ReceiveGoods({ orgId, po, onCancel, onDone }) {
  const locations = useLookup(['stock-locations', orgId], ({ signal }) => inventoryPlacesApi.locations(orgId, {}, { signal }), { enabled: Boolean(orgId) })
  const warehouses = (locations.data ?? []).filter((l) => l.location_type === 'platform_warehouse' && l.is_active)
  const [locationId, setLocationId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [lines, setLines] = useState(() =>
    po.items.filter((i) => i.quantity_received < i.quantity_ordered).map((i) => ({ item: i, received: i.quantity_ordered - i.quantity_received, rejected: 0, reason: '', serials: '' }))
  )
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // One key for this receipt: pressing "Receive" again after a network blip can't register the units twice.
  const key = useMemo(() => uuidv4(), [])

  const setLine = (n, patch) => setLines((ls) => ls.map((l, i) => (i === n ? { ...l, ...patch } : l)))
  const serialsOf = (l) => l.serials.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await purchaseOrdersApi.receive(orgId, {
        purchase_order_id: po.id,
        receiving_location_id: locationId || warehouses[0]?.id,
        vendor_invoice_no: invoice || undefined,
        items: lines.map((l) => ({
          purchase_order_item_id: l.item.id,
          quantity_received: Number(l.received),
          quantity_accepted: Number(l.received) - Number(l.rejected),
          quantity_rejected: Number(l.rejected),
          rejection_reason: l.reason || undefined,
          units: serialsOf(l).map((serial_number) => ({ serial_number })),
        })),
      }, key)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" style={{ marginTop: 16 }} onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Receive goods</h2>
      <ErrorBanner error={error} />
      <div className="grid-2">
        <label className="field">
          <span>Into</span>
          <select value={locationId || warehouses[0]?.id || ''} onChange={(e) => setLocationId(e.target.value)}>
            {warehouses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Vendor invoice no.</span>
          <input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </label>
      </div>
      {lines.map((l, n) => {
        const accepted = Number(l.received) - Number(l.rejected)
        const count = serialsOf(l).length
        return (
          <div key={l.item.id} style={{ borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: 12, marginTop: 12 }}>
            <strong>{l.item.device_model.manufacturer} {l.item.device_model.name}</strong>
            <span className="muted small"> · {l.item.quantity_ordered - l.item.quantity_received} still due</span>
            <div className="grid-3" style={{ marginTop: 8 }}>
              <label className="field"><span>Arrived</span><input type="number" min="0" value={l.received} onChange={(e) => setLine(n, { received: e.target.value })} /></label>
              <label className="field"><span>Rejected at QC</span><input type="number" min="0" value={l.rejected} onChange={(e) => setLine(n, { rejected: e.target.value })} /></label>
              <label className="field"><span>Why rejected</span><input value={l.reason} onChange={(e) => setLine(n, { reason: e.target.value })} /></label>
            </div>
            <label className="field">
              <span>Serial numbers of the {accepted} accepted unit(s): one per line, or scan them in</span>
              <textarea rows={Math.min(8, Math.max(2, accepted))} value={l.serials} onChange={(e) => setLine(n, { serials: e.target.value })} />
              <small className={count === accepted ? 'muted' : 'error'}>{count} of {accepted} serials</small>
            </label>
          </div>
        )
      })}
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Receive and register devices</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
