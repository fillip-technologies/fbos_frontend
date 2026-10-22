import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deviceCatalogApi, purchaseOrdersApi } from '@/features/inventory/api.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { getFieldErrors } from '@/shared/api/errors.js'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'

const emptyLine = () => ({ device_model_id: '', quantity_ordered: 1, unit_price: '', tax_percent: 18 })

export default function PurchaseOrderCreate() {
  const navigate = useNavigate()
  const { orgId } = useActiveOrg()
  const vendors = useLookup(['vendors', orgId], ({ signal }) => deviceCatalogApi.vendors(orgId, { signal }), { enabled: Boolean(orgId) })
  const models = useLookup(['device-models', orgId], ({ signal }) => deviceCatalogApi.models(orgId, { signal }), { enabled: Boolean(orgId) })
  const [form, setForm] = useState({ vendor_id: '', expected_date: '', notes: '', items: [emptyLine()] })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const fieldErrors = getFieldErrors(error)

  const setLine = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((l, n) => (n === i ? { ...l, ...patch } : l)) }))
  const pickModel = (i, id) => {
    const model = models.data?.find((m) => m.id === id)
    setLine(i, { device_model_id: id, ...(model?.default_unit_price ? { unit_price: model.default_unit_price.amount } : {}) })
  }
  const total = form.items.reduce((s, l) => s + Number(l.quantity_ordered || 0) * Number(l.unit_price || 0) * (1 + Number(l.tax_percent || 0) / 100), 0)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const po = await purchaseOrdersApi.create(orgId, {
        vendor_id: form.vendor_id,
        expected_date: form.expected_date || undefined,
        notes: form.notes || undefined,
        items: form.items.map((l) => ({
          device_model_id: l.device_model_id,
          quantity_ordered: Number(l.quantity_ordered),
          unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent),
        })),
      })
      invalidate(['purchase-orders', orgId])
      navigate(`/inventory/purchase-orders/${po.id}`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="page-head">
        <h1>New purchase order</h1>
        <button type="button" className="btn secondary" onClick={() => navigate('/inventory/purchase-orders')}>Cancel</button>
      </div>
      <ErrorBanner error={error} />
      <div className="panel">
        <div className="grid-2">
          <label className="field">
            <span>Vendor</span>
            <select required value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
              <option value="">Choose…</option>
              {(vendors.data ?? []).filter((v) => v.is_active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {fieldErrors.vendor_id && <small className="error">{fieldErrors.vendor_id}</small>}
          </label>
          <label className="field">
            <span>Expected by</span>
            <input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} />
          </label>
        </div>
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Model</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 140 }}>Unit price</th><th style={{ width: 90 }}>GST %</th><th /></tr></thead>
          <tbody>
            {form.items.map((l, i) => (
              <tr key={i}>
                <td>
                  <select required value={l.device_model_id} onChange={(e) => pickModel(i, e.target.value)}>
                    <option value="">Choose a model…</option>
                    {(models.data ?? []).filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.manufacturer} {m.name} ({m.model_number})</option>)}
                  </select>
                </td>
                <td><input type="number" min="1" required value={l.quantity_ordered} onChange={(e) => setLine(i, { quantity_ordered: e.target.value })} /></td>
                <td><input type="number" min="0" step="0.01" required value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} /></td>
                <td><input type="number" min="0" max="100" step="0.01" value={l.tax_percent} onChange={(e) => setLine(i, { tax_percent: e.target.value })} /></td>
                <td>{form.items.length > 1 && <button type="button" className="btn secondary" onClick={() => setForm({ ...form, items: form.items.filter((_, n) => n !== i) })}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row-actions" style={{ marginTop: 12, justifyContent: 'space-between' }}>
          <button type="button" className="btn secondary" onClick={() => setForm({ ...form, items: [...form.items, emptyLine()] })}>+ Add line</button>
          <strong>Total with GST: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(total)}</strong>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
      </div>
      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy} aria-busy={busy}>Save draft</button>
      </div>
    </form>
  )
}
