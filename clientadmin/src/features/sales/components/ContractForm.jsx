import { useState } from 'react'
import { contractsApi } from '@/features/sales/api.js'
import { getFieldErrors } from '@/shared/api/errors.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import { todayIso } from '@/shared/utils/dates.js'
import { CONTRACT_TYPES, PAYMENT_TRIGGERS } from '@/features/sales/utils.js'

const newTerm = (seq, percent = '') => ({ seq, trigger_type: 'advance', milestone_code: '', percent, due_offset_days: '15' })

// Turns an accepted quotation into a contract with a payment schedule (percentages total 100).
export default function ContractForm({ orgId, quotation, onCreated, onCancel }) {
  const [form, setForm] = useState({ contract_type: 'project', start_date: todayIso(), end_date: '', sla_tier: '' })
  const [terms, setTerms] = useState([newTerm(1, '100')])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fieldErrors = getFieldErrors(error)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setTerm = (index, k, v) => setTerms(terms.map((t, i) => (i === index ? { ...t, [k]: v } : t)))
  const total = terms.reduce((sum, t) => sum + Number(t.percent || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        quotation_id: quotation.id,
        contract_type: form.contract_type,
        start_date: form.start_date,
        payment_terms: terms.map((t, i) => {
          const term = {
            seq: i + 1,
            trigger_type: t.trigger_type,
            percent: Number(t.percent),
            due_offset_days: Number(t.due_offset_days || 0),
          }
          if (t.trigger_type === 'milestone' && t.milestone_code.trim()) term.milestone_code = t.milestone_code.trim()
          return term
        }),
      }
      if (form.end_date) body.end_date = form.end_date
      if (form.sla_tier.trim()) body.sla_tier = form.sla_tier.trim()
      onCreated(await contractsApi.create(orgId, body))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <form className="inline-panel" onSubmit={handleSubmit}>
      <h3>Create contract from {quotation.quote_no}</h3>
      {error && Object.keys(fieldErrors).length === 0 && <ErrorBanner error={error} />}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ct-type">Type</label>
          <select id="ct-type" value={form.contract_type} onChange={(e) => set('contract_type', e.target.value)}>
            {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ct-sla">SLA tier</label>
          <input id="ct-sla" value={form.sla_tier} onChange={(e) => set('sla_tier', e.target.value)} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ct-start">Start date *</label>
          <input id="ct-start" type="date" required value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ct-end">End date</label>
          <input
            id="ct-end"
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </div>
      </div>

      <h3 style={{ margin: '8px 0 6px', fontSize: 15 }}>Payment schedule</h3>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Milestone</th>
            <th style={{ width: 100 }}>%</th>
            <th style={{ width: 120 }}>Due after (days)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {terms.map((t, index) => (
            <tr key={index} style={{ cursor: 'default' }}>
              <td>
                <select aria-label="Trigger" value={t.trigger_type} onChange={(e) => setTerm(index, 'trigger_type', e.target.value)}>
                  {Object.entries(PAYMENT_TRIGGERS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                {t.trigger_type === 'milestone' && (
                  <input
                    aria-label="Milestone"
                    placeholder="e.g. UAT signed off"
                    value={t.milestone_code}
                    onChange={(e) => setTerm(index, 'milestone_code', e.target.value)}
                  />
                )}
              </td>
              <td>
                <input
                  aria-label="Percent"
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="any"
                  value={t.percent}
                  onChange={(e) => setTerm(index, 'percent', e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label="Due after days"
                  type="number"
                  min="0"
                  value={t.due_offset_days}
                  onChange={(e) => setTerm(index, 'due_offset_days', e.target.value)}
                />
              </td>
              <td>
                {terms.length > 1 && (
                  <button
                    type="button"
                    className="btn secondary small-btn"
                    aria-label="Remove term"
                    onClick={() => setTerms(terms.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row-actions" style={{ marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn secondary small-btn" onClick={() => setTerms([...terms, newTerm(terms.length + 1)])}>
          + Add payment
        </button>
        <span className={Math.abs(total - 100) > 0.01 ? 'field-error' : 'muted small'}>Total {total}% (must be 100%)</span>
      </div>

      <div className="row-actions" style={{ marginTop: 14 }}>
        <button className="btn" type="submit" disabled={saving || Math.abs(total - 100) > 0.01}>
          {saving ? 'Creating…' : 'Create contract'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
