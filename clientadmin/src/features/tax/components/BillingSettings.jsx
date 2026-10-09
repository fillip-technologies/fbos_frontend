import { useState } from 'react'
import { financeSettingsApi } from '@/features/tax/api.js'
import TaxCategorySelect from '@/features/tax/components/TaxCategorySelect.jsx'
import { useTaxCategories, useTaxEntries } from '@/features/tax/useTaxConfig.js'
import { BILLING_MODES, DEADLINE_MODES } from '@/features/tax/utils.js'
import { invalidate, useQuery } from '@/shared/api/useQuery.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { PanelSkeleton } from '@/shared/components/Skeleton.jsx'

const toForm = (settings) => ({
  billing_mode: settings.billing_mode,
  invoice_requires_schedule: settings.invoice_requires_schedule,
  credit_note_deadline_mode: settings.credit_note_deadline_mode,
  collections_on_net: settings.collections_on_net,
  default_payment_terms_days: String(settings.default_payment_terms_days),
  fiscal_year_start: settings.fiscal_year_start || '',
  default_tax_category: settings.default_tax_category || '',
  deductee_type: settings.deductee_type || '',
})

// How the company runs billing. Every setting starts at its default (version 0) until saved.
export default function BillingSettings({ orgId, canManage }) {
  const { data: settings, error: loadError, loading, reload, setData } = useQuery(
    ['finance-settings', orgId],
    ({ signal }) => financeSettingsApi.get(orgId, { signal }),
    { enabled: Boolean(orgId) }
  )
  const { categories } = useTaxCategories(orgId)
  const { entries: regimes } = useTaxEntries(orgId, 'regime')
  const deducteeTypes = [...new Set(regimes.flatMap((regime) => regime.data.deductee_types || []))]
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  if (loading) return <PanelSkeleton />
  if (!settings) return <ErrorBanner error={loadError} onRetry={reload} />
  const current = form ?? toForm(settings)
  const set = (k, v) => {
    setSaved(false)
    setForm({ ...current, [k]: v })
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const base = toForm(settings)
      const changes = {}
      for (const [k, v] of Object.entries(current)) {
        if (v === base[k]) continue
        if (k === 'default_payment_terms_days') changes[k] = Number(v)
        else if (typeof v === 'string') changes[k] = v === '' ? null : v
        else changes[k] = v
      }
      setData(await financeSettingsApi.update(orgId, settings, changes))
      invalidate(['invoices', orgId])
      setForm(null)
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const disabled = !canManage || saving
  return (
    <form className="panel" onSubmit={submit}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Billing settings</h2>
      <ErrorBanner error={error} />
      {saved && <div className="alert success">Saved.</div>}

      <div className="field">
        <label htmlFor="fs-mode">How contracts are billed</label>
        <select id="fs-mode" disabled={disabled} value={current.billing_mode} onChange={(e) => set('billing_mode', e.target.value)}>
          {Object.entries(BILLING_MODES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="hint">
          GST is owed on what is invoiced, not on what is paid. Billing in stages keeps the GST you pay close to the money you receive.
        </div>
      </div>
      <label className="inline-check">
        <input type="checkbox" disabled={disabled} checked={current.invoice_requires_schedule} onChange={(e) => set('invoice_requires_schedule', e.target.checked)} />
        A contract with a billing schedule is only invoiced from it
      </label>
      <p className="muted small" style={{ margin: '4px 0 14px' }}>So nothing is billed twice. Invoices without a contract aren’t affected.</p>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fs-deadline">A credit note after its legal deadline</label>
          <select id="fs-deadline" disabled={disabled} value={current.credit_note_deadline_mode} onChange={(e) => set('credit_note_deadline_mode', e.target.value)}>
            {Object.entries(DEADLINE_MODES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fs-terms">Days to pay, when an invoice doesn’t say</label>
          <input id="fs-terms" type="number" min="0" max="365" disabled={disabled} value={current.default_payment_terms_days} onChange={(e) => set('default_payment_terms_days', e.target.value)} />
        </div>
      </div>
      <label className="inline-check">
        <input type="checkbox" disabled={disabled} checked={current.collections_on_net} onChange={(e) => set('collections_on_net', e.target.checked)} />
        Collections chase the balance less the TDS the customer is expected to withhold
      </label>
      <p className="muted small" style={{ margin: '4px 0 14px' }}>Customers keep TDS by law, so chasing it only annoys them.</p>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="fs-category">Default tax category</label>
          <TaxCategorySelect id="fs-category" disabled={disabled} categories={categories} value={current.default_tax_category} onChange={(v) => set('default_tax_category', v)} blankLabel="The tax system’s default" />
          <div className="hint">For lines that name no category or offering.</div>
        </div>
        <div className="field">
          <label htmlFor="fs-deductee">What your company is, for TDS</label>
          <select id="fs-deductee" disabled={disabled} value={current.deductee_type} onChange={(e) => set('deductee_type', e.target.value)}>
            <option value="">Not set (the sections’ default rate)</option>
            {deducteeTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="hint">Some sections deduct at different rates for individuals and companies.</div>
        </div>
        <div className="field">
          <label htmlFor="fs-fy">Fiscal year starts (MM-DD)</label>
          <input id="fs-fy" placeholder="From the tax system" pattern="^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$" disabled={disabled} value={current.fiscal_year_start} onChange={(e) => set('fiscal_year_start', e.target.value)} />
          <div className="hint">Month first, e.g. 04-01. Blank: the tax system’s (April for India GST).</div>
        </div>
      </div>

      {canManage && (
        <div className="row-actions">
          <button className="btn" type="submit" disabled={saving || !form} aria-busy={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      )}
    </form>
  )
}
