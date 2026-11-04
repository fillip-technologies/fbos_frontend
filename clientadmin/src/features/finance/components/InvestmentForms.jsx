import { useState } from 'react'
import { incomeApi, investmentsApi } from '@/features/finance/api.js'
import { amountOrNull, changedFields, INCOME_TYPES, INVESTMENT_STATUS_LABELS, INVESTMENT_TYPES } from '@/features/finance/utils.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import Dialog from '@/shared/components/Dialog.jsx'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'

const investmentForm = (i) => ({
  name: i?.name ?? '',
  investment_type: i?.investment_type ?? 'fixed_deposit',
  institution: i?.institution ?? '',
  reference: i?.reference ?? '',
  investee_organization_id: i?.investee_organization_id ?? '',
  principal: i?.principal ?? '',
  currency: i?.currency ?? '',
  start_date: i?.start_date ?? todayIso(),
  maturity_date: i?.maturity_date ?? '',
  expected_rate_pct: i?.expected_rate_pct ?? '',
  current_value: i?.current_value ?? '',
  current_value_on: i?.current_value_on ?? '',
  status: i?.status ?? 'active',
  notes: i?.notes ?? '',
})

function investmentBody(form, editing) {
  const body = {
    name: form.name.trim(),
    investment_type: form.investment_type,
    institution: form.institution.trim() || null,
    reference: form.reference.trim() || null,
    investee_organization_id: form.investment_type === 'equity' ? form.investee_organization_id || null : null,
    principal: amountOrNull(form.principal),
    currency: form.currency.trim().toUpperCase() || null,
    start_date: form.start_date,
    maturity_date: form.maturity_date || null,
    expected_rate_pct: amountOrNull(form.expected_rate_pct),
    current_value: amountOrNull(form.current_value),
    current_value_on: form.current_value ? form.current_value_on || todayIso() : null,
    notes: form.notes.trim() || null,
  }
  if (editing) body.status = form.status
  return body
}

// Record an investment, or edit one (`investment`): only what changed is sent.
export function InvestmentForm({ orgId, investment, onClose, onSaved }) {
  const editing = Boolean(investment)
  const { orgs } = useActiveOrg()
  const [form, setForm] = useState(() => investmentForm(investment))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  // Equity in a company of this account (set to "Investment" on the Companies page).
  const companies = (orgs ?? []).filter((o) => o.id !== orgId)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = investmentBody(form, editing)
      onSaved(editing
        ? await investmentsApi.update(orgId, investment.id, changedFields(investmentBody(investmentForm(investment), true), body))
        : await investmentsApi.create(orgId, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title={editing ? 'Edit investment' : 'Record an investment'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <div className="grid-2">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="i-name">Name</label>
            <input id="i-name" value={form.name} onChange={set('name')} maxLength={200} required placeholder="e.g. HDFC FD 2026-27" />
          </div>
          <div className="field">
            <label htmlFor="i-type">Kind</label>
            <select id="i-type" value={form.investment_type} onChange={set('investment_type')}>
              {Object.entries(INVESTMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {editing && (
            <div className="field">
              <label htmlFor="i-status">Status</label>
              <select id="i-status" value={form.status} onChange={set('status')}>
                {Object.entries(INVESTMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          {form.investment_type === 'equity' && companies.length > 0 && (
            <div className="field">
              <label htmlFor="i-investee">In one of your companies?</label>
              <select id="i-investee" value={form.investee_organization_id} onChange={set('investee_organization_id')}>
                <option value="">No, another company</option>
                {companies.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="i-institution">Held with</label>
            <input id="i-institution" value={form.institution} onChange={set('institution')} maxLength={200} placeholder="Bank, fund house, broker" />
          </div>
          <div className="field">
            <label htmlFor="i-reference">Reference</label>
            <input id="i-reference" value={form.reference} onChange={set('reference')} maxLength={120} placeholder="FD no., folio, deed" />
          </div>
          <div className="field">
            <label htmlFor="i-principal">Amount invested</label>
            <input id="i-principal" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.principal} onChange={set('principal')} required />
          </div>
          <div className="field">
            <label htmlFor="i-currency">Currency</label>
            <input id="i-currency" value={form.currency} onChange={set('currency')} maxLength={3} placeholder="Company’s currency" />
          </div>
          <div className="field">
            <label htmlFor="i-start">Invested on</label>
            <input id="i-start" type="date" value={form.start_date} onChange={set('start_date')} required />
          </div>
          <div className="field">
            <label htmlFor="i-maturity">Matures on</label>
            <input id="i-maturity" type="date" value={form.maturity_date} onChange={set('maturity_date')} min={form.start_date} />
          </div>
          <div className="field">
            <label htmlFor="i-rate">Expected return (% a year)</label>
            <input id="i-rate" type="number" min="0" step="0.001" value={form.expected_rate_pct} onChange={set('expected_rate_pct')} />
          </div>
          <div className="field">
            <label htmlFor="i-value">Current value</label>
            <input id="i-value" type="number" min="0" step="0.01" inputMode="decimal" value={form.current_value} onChange={set('current_value')} />
            <div className="hint">Empty: counted at the amount invested.</div>
          </div>
          {form.current_value && (
            <div className="field">
              <label htmlFor="i-value-on">Value as of</label>
              <input id="i-value-on" type="date" value={form.current_value_on} onChange={set('current_value_on')} />
            </div>
          )}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="i-notes">Notes</label>
            <textarea id="i-notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Record investment'}</button>
        </div>
      </form>
    </Dialog>
  )
}

// Record income outside sales (interest, dividend, rent…), optionally against an investment.
export function IncomeForm({ orgId, investments = [], investmentId = '', onClose, onSaved }) {
  const [form, setForm] = useState({
    income_type: 'interest', amount: '', tax_deducted: '0', currency: '', received_on: todayIso(), investment_id: investmentId, description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await incomeApi.create(orgId, {
        income_type: form.income_type,
        amount: amountOrNull(form.amount),
        tax_deducted: amountOrNull(form.tax_deducted) ?? '0',
        currency: form.currency.trim().toUpperCase() || null,
        received_on: form.received_on,
        investment_id: form.investment_id || null,
        description: form.description.trim() || null,
      }))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog title="Record other income" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="hint" style={{ marginTop: 0 }}>Income other than sales. Money from customers is recorded as a payment against their invoice.</p>
        <ErrorBanner error={error} />
        <div className="grid-2">
          <div className="field">
            <label htmlFor="n-type">Kind</label>
            <select id="n-type" value={form.income_type} onChange={set('income_type')}>
              {Object.entries(INCOME_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="n-date">Received on</label>
            <input id="n-date" type="date" value={form.received_on} onChange={set('received_on')} required />
          </div>
          <div className="field">
            <label htmlFor="n-amount">Amount (before tax deducted)</label>
            <input id="n-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
          </div>
          <div className="field">
            <label htmlFor="n-tds">Tax deducted at source</label>
            <input id="n-tds" type="number" min="0" step="0.01" inputMode="decimal" value={form.tax_deducted} onChange={set('tax_deducted')} />
          </div>
          {!investmentId && (
            <div className="field">
              <label htmlFor="n-investment">From an investment</label>
              <select id="n-investment" value={form.investment_id} onChange={set('investment_id')}>
                <option value="">None</option>
                {investments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="n-currency">Currency</label>
            <input id="n-currency" value={form.currency} onChange={set('currency')} maxLength={3} placeholder="Company’s currency" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="n-description">Description</label>
            <input id="n-description" value={form.description} onChange={set('description')} maxLength={500} />
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Record income'}</button>
        </div>
      </form>
    </Dialog>
  )
}
