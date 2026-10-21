import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { deviceCatalogApi } from '@/features/inventory/api.js'
import { formatMoneyValue } from '@/features/inventory/utils.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import { invalidate, useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'

const VENDOR_TYPES = { manufacturer: 'Manufacturer', distributor: 'Distributor', service_center: 'Service centre', other: 'Other' }

// Device models (what you order) and vendors (who you order from or send repairs to).
export default function DeviceCatalog() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'vendors' ? 'vendors' : 'models'
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Models &amp; vendors</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>Purchase orders and goods receipts pick from these.</p>
        </div>
      </div>
      <div className="version-tabs" role="tablist">
        {[['models', 'Device models'], ['vendors', 'Vendors']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'models' ? {} : { tab: key }, { replace: true })}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'models' ? <Models /> : <Vendors />}
    </div>
  )
}

function Models() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canWrite = hasAccess(me, ACCESS.manageDeviceCatalog)
  const { data, error, loading, reload } = useLookup(['device-models', orgId], ({ signal }) => deviceCatalogApi.models(orgId, { signal }), { enabled: Boolean(orgId) })
  // Device codes (CAM-000123) come from a category's series, so a model needs one to be received.
  const categories = useLookup(['device-categories', orgId], ({ signal }) => deviceCatalogApi.categories(orgId, { signal }), { enabled: Boolean(orgId) })
  const [form, setForm] = useState(null)
  const [saveError, setSaveError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaveError(null)
    try {
      await deviceCatalogApi.createModel(orgId, {
        name: form.name,
        manufacturer: form.manufacturer,
        model_number: form.model_number,
        category_id: form.category_id || undefined,
        default_warranty_months: Number(form.default_warranty_months),
        default_unit_price: form.default_unit_price ? Number(form.default_unit_price) : undefined,
        stores_data: form.stores_data,
      })
      setForm(null)
      invalidate(['device-models', orgId])
    } catch (err) {
      setSaveError(err)
    }
  }

  return (
    <>
      <ErrorBanner error={error} onRetry={reload} />
      {canWrite && !form && (
        <div className="row-actions" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setForm({ name: '', manufacturer: '', model_number: '', category_id: categories.data?.[0]?.id ?? '', default_warranty_months: 12, default_unit_price: '', stores_data: false })}>+ New model</button>
        </div>
      )}
      {form && (
        <form className="panel" onSubmit={save} style={{ marginBottom: 12 }}>
          <ErrorBanner error={saveError} />
          <div className="grid-3">
            <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span>Manufacturer</span><input required value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
            <label className="field"><span>Model number</span><input required value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} /></label>
            <label className="field">
              <span>Category (device code series)</span>
              <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Choose…</option>
                {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code}-…)</option>)}
              </select>
            </label>
            <label className="field"><span>Warranty (months)</span><input type="number" min="0" value={form.default_warranty_months} onChange={(e) => setForm({ ...form, default_warranty_months: e.target.value })} /></label>
            <label className="field"><span>Usual price</span><input type="number" min="0" step="0.01" value={form.default_unit_price} onChange={(e) => setForm({ ...form, default_unit_price: e.target.value })} /></label>
          </div>
          <label className="field" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.stores_data} onChange={(e) => setForm({ ...form, stores_data: e.target.checked })} />
            <span>Stores data (needs a wipe certificate before disposal)</span>
          </label>
          <div className="row-actions"><button className="btn">Save model</button><button type="button" className="btn secondary" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Model</th><th>Manufacturer</th><th>Code series</th><th>Warranty</th><th>Usual price</th><th>Devices</th></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={6} /> : (data ?? []).map((m) => (
              <tr key={m.id}>
                <td><div style={{ fontWeight: 600 }}>{m.name}</div><div className="muted small mono">{m.model_number}</div></td>
                <td>{m.manufacturer === 'Unknown' ? <span className="muted">Not filled in yet</span> : m.manufacturer}</td>
                <td>{m.category_name ?? <span className="muted">—</span>}</td>
                <td>{m.default_warranty_months} months</td>
                <td>{formatMoneyValue(m.default_unit_price) ?? <span className="muted">—</span>}</td>
                <td>{m.device_count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Vendors() {
  const { user: me } = useAuth()
  const { orgId } = useActiveOrg()
  const canWrite = hasAccess(me, ACCESS.manageDeviceCatalog)
  const { data, error, loading, reload } = useLookup(['vendors', orgId], ({ signal }) => deviceCatalogApi.vendors(orgId, { signal }), { enabled: Boolean(orgId) })
  const [form, setForm] = useState(null)
  const [saveError, setSaveError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaveError(null)
    try {
      await deviceCatalogApi.createVendor(orgId, {
        name: form.name, vendor_type: form.vendor_type, contact_name: form.contact_name || null,
        email: form.email || null, phone: form.phone || null, gst_number: form.gst_number || null,
      })
      setForm(null)
      invalidate(['vendors', orgId])
      invalidate(['stock-locations', orgId])
    } catch (err) {
      setSaveError(err)
    }
  }

  return (
    <>
      <ErrorBanner error={error} onRetry={reload} />
      {canWrite && !form && (
        <div className="row-actions" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setForm({ name: '', vendor_type: 'distributor', contact_name: '', email: '', phone: '', gst_number: '' })}>+ New vendor</button>
        </div>
      )}
      {form && (
        <form className="panel" onSubmit={save} style={{ marginBottom: 12 }}>
          <ErrorBanner error={saveError} />
          <div className="grid-3">
            <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">
              <span>Kind</span>
              <select value={form.vendor_type} onChange={(e) => setForm({ ...form, vendor_type: e.target.value })}>
                {Object.entries(VENDOR_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field"><span>GSTIN</span><input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></label>
            <label className="field"><span>Contact</span><input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></label>
            <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          <div className="row-actions"><button className="btn">Save vendor</button><button type="button" className="btn secondary" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Vendor</th><th>Kind</th><th>Contact</th><th>GSTIN</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? <TableSkeleton cols={5} /> : (data ?? []).length === 0 ? (
              <tr><td colSpan={5} className="center-note">No vendors yet.</td></tr>
            ) : data.map((v) => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600 }}>{v.name}</td>
                <td>{VENDOR_TYPES[v.vendor_type]}</td>
                <td>{v.contact_name}{v.email && <div className="muted small">{v.email}</div>}</td>
                <td className="mono">{v.gst_number}</td>
                <td><StatusBadge status={v.is_active ? 'active' : 'inactive'} label={v.is_active ? 'Active' : 'Inactive'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
