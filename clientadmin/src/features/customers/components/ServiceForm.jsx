import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import {
  BILLING_CYCLES,
  MANAGED_BY,
  SERVICE_STATUSES,
  capitalize,
  changedFields,
  serviceFromForm,
  serviceToForm,
} from '@/features/customers/utils.js'

// Add or edit one outside service of a customer. `onSave(body)` gets the full body for a
// new record and only the changed fields for an existing one; it may throw an ApiError.
export default function ServiceForm({ service, providers, categories, defaultCurrency, onSave, onCancel }) {
  const [form, setForm] = useState(() => serviceToForm(service, defaultCurrency))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // A provider brings its usual category along unless one was already picked.
  function pickProvider(id) {
    const provider = providers.find((p) => p.id === id)
    setForm((f) => ({ ...f, provider_id: id, category_id: f.category_id || provider?.category?.id || '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = serviceFromForm(form)
      await onSave(service ? changedFields(serviceFromForm(serviceToForm(service, defaultCurrency)), body) : body)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const activeCategories = categories.filter((c) => c.is_active || c.id === form.category_id)

  if (!providers.length) {
    return (
      <div className="inline-panel">
        <p className="muted" style={{ margin: 0 }}>
          Add a provider first (the company that supplies the service, e.g. Airtel or GoDaddy) on the{' '}
          <Link to="/service-providers">Service providers</Link> page.
        </p>
        <div className="row-actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn secondary" onClick={onCancel}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>{service ? `Edit “${service.name}”` : 'Add a service'}</h3>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="svc-name">What is it *</label>
          <input
            id="svc-name"
            required
            maxLength={255}
            placeholder="e.g. acme.com, Fire insurance policy"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="svc-ref">Account / policy number</label>
          <input id="svc-ref" maxLength={255} value={form.reference_no} onChange={(e) => set('reference_no', e.target.value)} />
          <div className="hint">Never a password.</div>
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="svc-provider">Provider *</label>
          <select id="svc-provider" required value={form.provider_id} onChange={(e) => pickProvider(e.target.value)}>
            <option value="">— Choose —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="svc-category">Category</label>
          <select id="svc-category" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">{service ? '— None —' : "— Provider's category —"}</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="svc-managed">Managed</label>
          <select id="svc-managed" value={form.managed_by} onChange={(e) => set('managed_by', e.target.value)}>
            {Object.entries(MANAGED_BY).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="svc-start">Start date</label>
          <input
            id="svc-start"
            type="date"
            max={todayIso()}
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
          {fieldErrors.start_date && <div className="field-error">{fieldErrors.start_date}</div>}
        </div>
        <div className="field">
          <label htmlFor="svc-end">End date</label>
          <input
            id="svc-end"
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="svc-renewal">Renewal date</label>
          <input id="svc-renewal" type="date" value={form.renewal_date} onChange={(e) => set('renewal_date', e.target.value)} />
          <label className="inline-check" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={form.auto_renew} onChange={(e) => set('auto_renew', e.target.checked)} />
            Renews automatically
          </label>
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="svc-cost">Cost</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="svc-cost"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_amount}
              onChange={(e) => set('cost_amount', e.target.value)}
            />
            <input
              aria-label="Currency"
              className="mono-input"
              maxLength={3}
              style={{ width: 70 }}
              value={form.cost_currency}
              onChange={(e) => set('cost_currency', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="svc-cycle">Billed</label>
          <select id="svc-cycle" value={form.billing_cycle} onChange={(e) => set('billing_cycle', e.target.value)}>
            <option value="">—</option>
            {Object.entries(BILLING_CYCLES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="svc-status">Status</label>
          <select id="svc-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {SERVICE_STATUSES.map((s) => (
              <option key={s} value={s}>{capitalize(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="svc-notes">Notes</label>
        <textarea id="svc-notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="row-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : service ? 'Save changes' : 'Add service'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
