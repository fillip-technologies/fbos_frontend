import { useState } from 'react'
import { offeringsApi } from '@/features/sales/api.js'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import { formatMoney } from '@/features/customers/utils.js'
import { friendlyMessage, getFieldErrors } from '@/shared/api/errors.js'
import { useLookup } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { TableSkeleton } from '@/shared/components/Skeleton.jsx'
import StatusBadge from '@/shared/components/StatusBadge.jsx'
import useVerticals from '@/features/sales/useVerticals.js'
import { BILLING_MODELS, OFFERING_UNITS } from '@/features/sales/utils.js'

const EMPTY = (currency) => ({
  code: '',
  name: '',
  vertical_id: '',
  sac_code: '',
  gst_rate: '18',
  unit: 'project',
  billing_model: 'one_time',
  price: '',
  currency,
})

function OfferingForm({ orgId, verticals, defaultCurrency, onCreated, onCancel }) {
  const [form, setForm] = useState(() => EMPTY(defaultCurrency))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  if (error?.code === 'DUPLICATE_CODE') fieldErrors.code = friendlyMessage(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await offeringsApi.create(orgId, {
        code: form.code.trim(),
        name: form.name.trim(),
        vertical_id: form.vertical_id,
        sac_code: form.sac_code.trim(),
        gst_rate: Number(form.gst_rate),
        unit: form.unit,
        billing_model: form.billing_model,
        list_price: { amount: Number(form.price), currency: form.currency.trim().toUpperCase() },
      })
      onCreated()
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const field = (k, label, props = {}, hint) => (
    <div className="field">
      <label htmlFor={`off-${k}`}>{label}</label>
      <input id={`off-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
      {hint && <div className="hint">{hint}</div>}
      {fieldErrors[k] && <div className="field-error">{fieldErrors[k]}</div>}
    </div>
  )

  return (
    <form className="inline-panel" onSubmit={handleSubmit} style={{ marginTop: 0, marginBottom: 14 }}>
      <h3>New offering</h3>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-3">
        {field('name', 'Name *', { required: true, maxLength: 255 })}
        {field('code', 'Code *', { required: true, maxLength: 100, className: 'mono-input' }, 'A short unique SKU.')}
        <div className="field">
          <label htmlFor="off-vertical">Vertical *</label>
          <select id="off-vertical" required value={form.vertical_id} onChange={(e) => set('vertical_id', e.target.value)}>
            <option value="">— Choose —</option>
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="off-price">List price *</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="off-price"
              type="number"
              required
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
            <input
              aria-label="Currency"
              className="mono-input"
              maxLength={3}
              style={{ width: 70 }}
              value={form.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="off-unit">Per</label>
          <select id="off-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            {Object.entries(OFFERING_UNITS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="off-billing">Billing</label>
          <select id="off-billing" value={form.billing_model} onChange={(e) => set('billing_model', e.target.value)}>
            {Object.entries(BILLING_MODELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid-2">
        {field('sac_code', 'SAC code *', { required: true, maxLength: 20, className: 'mono-input' }, 'GST services code, e.g. 998313.')}
        {field('gst_rate', 'GST rate % *', { required: true, type: 'number', min: 0, max: 100, step: 'any' })}
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add offering'}</button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}

// The catalog of what the company sells; quotation lines are picked from it.
export default function Offerings() {
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const { verticals, verticalName } = useVerticals(orgId)
  const canManage = hasAccess(me, ACCESS.manageOfferings)
  const { data, error, loading, reload } = useLookup(['offerings', orgId, 'all'], ({ signal }) => offeringsApi.listAll(orgId, { signal }), {
    enabled: Boolean(orgId),
  })
  const offerings = data ?? []
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Offerings</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            What {activeOrg ? `“${activeOrg.name}”` : 'this company'} sells, with list prices and GST. Quotations are built
            from these.
          </p>
        </div>
        <div className="row-actions">
          <OrgSwitcher onChange={() => setAdding(false)} />
          {canManage && !adding && <button className="btn" onClick={() => setAdding(true)}>+ New offering</button>}
        </div>
      </div>

      <ErrorBanner error={error} onRetry={reload} />
      {adding && (
        <OfferingForm
          orgId={orgId}
          verticals={verticals}
          defaultCurrency={activeOrg?.base_currency || 'INR'}
          onCreated={() => {
            setAdding(false)
            reload()
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Offering</th>
              <th>Vertical</th>
              <th>List price</th>
              <th>GST</th>
              <th>Billing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} />
            ) : offerings.length === 0 ? (
              <tr><td colSpan={6} className="center-note">No offerings yet.</td></tr>
            ) : (
              offerings.map((o) => (
                <tr key={o.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div className="muted small mono">{o.code}</div>
                  </td>
                  <td>{(o.vertical && verticalName(o.vertical.id)) || <span className="muted">—</span>}</td>
                  <td>
                    {formatMoney(o.list_price)} <span className="muted small">/ {OFFERING_UNITS[o.unit] || o.unit}</span>
                  </td>
                  <td>
                    {o.gst_rate}% <span className="muted small mono">SAC {o.sac_code}</span>
                  </td>
                  <td>{BILLING_MODELS[o.billing_model] || o.billing_model}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
